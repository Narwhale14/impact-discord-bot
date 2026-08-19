const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType } = require('discord.js');
const { getAllLinkedPlayers } = require('../../utils/DBManagers/linkedPlayersManager.js')
const { getGuildData, updateGuildColumn } = require('../../utils/DBManagers/guildDataManager.js');
const { getGuildById, getBestSkyblockLevelByUUID } = require('../../utils/APIManagers/hypixelAPIManager.js');
const { getEligibleRoleId, updateMappedRole, removeMappedRoles } = require('../../utils/roleHelpers.js')
const embeds = require('../../interactions/embeds.js');

const CHUNK_SIZE = 5;
const CHUNK_DELAY_MS = 7500;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runningUpdates = new Set();

/**
 * @command - /rank
 * manages linking discord roles to ingame ranks
 *
 * /rank link
 * /rank unlink
 * /rank updatereq
 * /rank updateall
 * /rank clearall
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setContexts(InteractionContextType.Guild)
        .setDescription('Connection manager between in-game guild rank with discord role')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('link')
            .setDescription('Link hypixel guild rank to discord role')
            .addStringOption(option => option.setName('hypixel_rank').setDescription('Guild rank').setRequired(true))
            .addRoleOption(option => option.setName('server_role').setDescription('Server role').setRequired(true))
            .addIntegerOption(option => option.setName('requirement').setDescription('Skyblock level requirement').setMinValue(0).setRequired(false)))
        .addSubcommand(sub => sub
            .setName('unlink')
            .setDescription('Unlink hypixel guild rank to discord role')
            .addStringOption(option => option.setName('hypixel_rank').setDescription('Guild rank').setRequired(true)))
        .addSubcommand(sub => sub 
            .setName('updatereq')
            .setDescription('Updates requirements of a linked rank')
            .addStringOption(option => option.setName('hypixel_rank').setDescription('Guild rank').setRequired(true))
            .addIntegerOption(option => option.setName('requirement').setDescription('Skyblock level requirement').setMinValue(0).setRequired(true)))
        .addSubcommand(sub => sub
            .setName('updateall')
            .setDescription('Re-syncs rank roles for every linked member in the server'))    
        .addSubcommand(sub => sub
            .setName('clearall')
            .setDescription('Clears discord role based on guild rank from ALL users')),
        adminOnly: true,
        dangerousSubcommands: ['clearall', 'updateall'],
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        const guildDBData = await getGuildData(interaction.guild);
        if(!guildDBData?.hypixel_guild_id) return interaction.editReply({ embeds: [embeds.guildNotLinked()] });

        // link subcommand
        if(subcommand === 'link') {
            const hypixelRank = interaction.options.getString('hypixel_rank').trim().toUpperCase();
            const discordRole = interaction.options.getRole('server_role');
            const requirement = interaction.options.getInteger('requirement');

            const hypixelGuild = await getGuildById(guildDBData.hypixel_guild_id);
            if(!hypixelGuild.ranks.find(r => r.tag?.trim().toUpperCase() === hypixelRank))
                return interaction.editReply({ embeds: [embeds.errorEmbed(`The guild rank **${hypixelRank}** does not exist in Hypixel guild **${hypixelGuild.name}**`)] });

            const roleMappings = guildDBData?.role_mappings || {};
            if(roleMappings[hypixelRank])
                return interaction.editReply({ embeds: [embeds.errorEmbed(`The guild rank **${hypixelRank}** is already linked to <@&${roleMappings[hypixelRank].discord_role_id}>!`)], allowedMentions: { roles: [] } });

            roleMappings[hypixelRank] = { 
                discord_role_id: discordRole.id,
                ...(requirement !== null && { level_requirement: requirement })
            }

            try {
                await updateGuildColumn(interaction.guild, 'role_mappings', roleMappings);

                const requirementText = requirement !== null ? ` (Level Requirement: **${requirement}**)` : '';
                await interaction.editReply({ embeds: [embeds.successEmbed(`Linked **${hypixelRank}** to <@&${discordRole.id}> successfully!${requirementText}`, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
            } catch(err) {
                console.error("Failed running '/rank link': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while linking roles.", err.message)] });
            } 
        }

        // unlink subcommand
        if(subcommand === 'unlink') {     
            const hypixelRank = interaction.options.getString('hypixel_rank').trim().toUpperCase();

            const roleMappings = guildDBData?.role_mappings || {};
                if(!roleMappings[hypixelRank])
                    return interaction.editReply({ embeds: [embeds.errorEmbed(`The guild rank **${hypixelRank}** is not current linked to any discord role!`)] });
                delete roleMappings[hypixelRank];

            try {
                await updateGuildColumn(interaction.guild, 'role_mappings', roleMappings);

                await interaction.editReply({ embeds: [embeds.successEmbed(`Unlinked **${hypixelRank}** from it's discord role successfully!`, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
            } catch(err) {
                console.error("Failed running '/rank unlink': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while unlinking roles.", err.message)] });
            } 
        }

        // update req subcommand
        if(subcommand === 'updatereq') {
            const hypixelRank = interaction.options.getString('hypixel_rank').trim().toUpperCase();
            const newRequirement = interaction.options.getInteger('requirement');

            const hypixelGuild = await getGuildById(guildDBData.hypixel_guild_id);
            if(!hypixelGuild.ranks.find(r => r.tag?.trim().toUpperCase() === hypixelRank))
                return interaction.editReply({ embeds: [embeds.errorEmbed(`The guild rank **${hypixelRank}** does not exist in Hypixel guild **${hypixelGuild.name}**`)] });

            const roleMappings = guildDBData?.role_mappings || {};
            if(!roleMappings[hypixelRank])
                return interaction.editReply({ embeds: [embeds.errorEmbed(`The guild rank** ${hypixelRank}** is not linked yet.\nPlease run: \`/linkrole <hypixel rank> <server role> <optional: requirement>\``)] });

            roleMappings[hypixelRank].level_requirement = newRequirement;

            try {
                await updateGuildColumn(interaction.guild, 'role_mappings', roleMappings);

                await interaction.editReply({ embeds: [embeds.successEmbed(`Updated the **${hypixelRank}** level requirement to **${newRequirement}**.`, interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                console.error("Failed running '/rank updatereq': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while updating requirement.", err.message)] });
            } 
        }

        // updateall subcommand
        if(subcommand === 'updateall') {
            const roleMappings = guildDBData.role_mappings || {};
            if(Object.keys(roleMappings).length === 0)
                return interaction.editReply({ embeds: [embeds.errorEmbed('No guild ranks are linked to roles yet.\nRun `/rank link <hypixel rank> <server role> <requirement>` first.')] });

            const linkedPlayers = await getAllLinkedPlayers(guildDBData.id);
            if(linkedPlayers.length === 0)
                return interaction.editReply({ embeds: [embeds.errorEmbed('No members are linked in this server yet.')] });

            if(runningUpdates.has(interaction.guild.id))
                return interaction.editReply({ embeds: [embeds.errorEmbed('A role update is already running in this server.\nWait for it to finish before starting another.')] });
            runningUpdates.add(interaction.guild.id);

            try {
                const progressEmbed = scanned => embeds.successEmbed(`Players Scanned: **${scanned}** / **${linkedPlayers.length}**\nThis may take some time.`, embeds.WARNING_COLOR, 'Updating Roles...');
                await interaction.editReply({ embeds: [progressEmbed(0)] });

                const hypixelGuild = await getGuildById(guildDBData.hypixel_guild_id);
                const ranksByUUID = new Map(hypixelGuild.members.map(m => [m.uuid, m.rank?.toUpperCase()]));

                const logsChannel = interaction.guild.channels.cache.get(guildDBData?.logs_channel_id);
                const canNotify = guildDBData.requests_enabled === true && logsChannel?.isTextBased();

                await interaction.guild.members.fetch();

                const stats = { updated: 0, notInGuild: 0, notInServer: 0, failed: 0 };

                const processPlayer = async player => {
                    const memberDiscord = interaction.guild.members.cache.get(player.discord_id);
                    if(!memberDiscord) return stats.notInServer++;

                    const inGameRank = ranksByUUID.get(player.hypixel_uuid);
                    if(!inGameRank) return stats.notInGuild++;

                    try {
                        const { level } = await getBestSkyblockLevelByUUID(player.hypixel_uuid);

                        const eligibleRole = getEligibleRoleId(roleMappings, level);
                        if(!eligibleRole) return;

                        if(await updateMappedRole(memberDiscord, roleMappings, eligibleRole.discord_role_id)) stats.updated++;
                        if(inGameRank === eligibleRole.rank || !roleMappings[inGameRank] || !canNotify) return;

                        const logsEmbed = new EmbedBuilder()
                            .setTitle('New Role Update!')
                            .setDescription(`<@${player.discord_id}>'s role has upgraded to <@&${eligibleRole.discord_role_id}>\n When available, promote **${player.hypixel_name}** in-game to **${eligibleRole.rank}**`)
                            .setThumbnail(memberDiscord.user.displayAvatarURL({ size: 1024 }))
                            .setColor(embeds.WARNING_COLOR)
                            .setTimestamp();

                        const logsRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('role_update_complete_button').setLabel('Complete').setStyle(ButtonStyle.Success)
                        );

                        await logsChannel.send({
                            embeds: [logsEmbed],
                            components: [logsRow]
                        });
                    } catch(err) {
                        stats.failed++;
                        console.error(`'/rank updateall' failed for ${player.hypixel_name}: `, err.message);
                    }
                };

                for(let i = 0; i < linkedPlayers.length; i += CHUNK_SIZE) {
                    await Promise.all(linkedPlayers.slice(i, i + CHUNK_SIZE).map(processPlayer));
                    await interaction.editReply({ embeds: [progressEmbed(Math.min(i + CHUNK_SIZE, linkedPlayers.length))] }).catch(() => null);

                    if(i + CHUNK_SIZE < linkedPlayers.length) await sleep(CHUNK_DELAY_MS);
                }

                const summaryEmbed = new EmbedBuilder()
                    .setTitle('Role Update Complete')
                    .setColor(interaction.guild.members.me.displayHexColor)
                    .addFields(
                        { name: 'Players Scanned', value: `${linkedPlayers.length}`, inline: true },
                        { name: 'Players Updated', value: `${stats.updated}`, inline: true },
                        { name: 'Not In Guild', value: `${stats.notInGuild}`, inline: true },
                        { name: 'Not In Server', value: `${stats.notInServer}`, inline: true },
                        { name: 'Failed', value: `${stats.failed}`, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [summaryEmbed] });
            } catch(err) {
                console.error("An error occured while updating all roles in '/rank updateall': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed('An error occurred while updating all rank roles.', err.message)] });
            } finally {
                runningUpdates.delete(interaction.guild.id);
            }
        }

        // clearall subcommand
        if(subcommand === 'clearall') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_clear:${interaction.user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`cancel_clear:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            const mainEmbed = new EmbedBuilder()
                .setTitle('⚠️ WARNING')
                .setDescription('Are you sure you want to clear all rank roles from members?\n**This is irreversible.**')
                .setColor(embeds.WARNING_COLOR)
                .setTimestamp();
            await interaction.editReply({ embeds: [mainEmbed], components: [row] });

            const filter = i => i.user.id === interaction.user.id
            const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);

            if(!buttonInteraction) {
                row.components.forEach(b => b.setDisabled(true));
                mainEmbed.setTitle('ERROR').setDescription('Role clear timed out.').setColor(embeds.ERROR_COLOR);
                return interaction.editReply({ embeds: [mainEmbed], components: [] });
            }

            // disable after getting interaction
            row.components.forEach(b => b.setDisabled(true));

            if(buttonInteraction.customId === `cancel_clear:${interaction.user.id}`) {
                mainEmbed.setTitle('Cancelled').setDescription('Role cleared cancelled.').setColor(interaction.guild.members.me.displayHexColor)
                return buttonInteraction.update({ embeds: [mainEmbed], components: [] });
            }

            if(buttonInteraction.customId === `confirm_clear:${interaction.user.id}`) {
                await buttonInteraction.deferReply();
                if(!guildDBData?.verification_role) return buttonInteraction.editReply({ embeds: [embeds.errorEmbed('Verification role does not exist!')] });

                const roleMappings = guildDBData.role_mappings || {};

                try {
                    await interaction.guild.members.fetch();

                    let affectedMembers = 0;
                    let removedRoles = 0;

                    for(const member of interaction.guild.members.cache.values()) {
                        if(!member.roles.cache.has(guildDBData.verification_role))
                            continue;

                        const removed = await removeMappedRoles(member, roleMappings);
                        if(removed > 0) {
                            affectedMembers++;
                            removedRoles += removed;
                        }
                    }

                    return buttonInteraction.editReply({ 
                        embeds: [embeds.successEmbed(`Cleared rank roles from **${affectedMembers}** verified users.\nTotal roles removed: **${removedRoles}**`, interaction.guild.members.me.displayHexColor)], 
                        components: [] 
                    });
                } catch(err) {
                    console.error("An error occured while clearing all roles in '/rank clearall': ", err);
                    await buttonInteraction.editReply({ embeds: [embeds.errorEmbed("An error occurred while clearing all rank related roles.", err.message)] });
                }
            }
        }
    }
}