const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildData, updateGuildColumn } = require('../../utils/DBManagers/guildDataManager.js');
const { getGuildById } = require('../../utils/APIManagers/hypixelAPIManager.js');
const embeds = require('../../interactions/embeds.js');

/**
 * @command - /rank
 * manages linking discord roles to ingame ranks
 * 
 * /rank link
 * /rank unlink
 * /rank updatereq
 * /rank clearall
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
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
            .setName('clearall')
            .setDescription('Clears discord role based on guild rank from ALL users')),
        adminOnly: true,
        dangerousSubcommands: ['clearall'],
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
                if(!guildDBData?.verification_role) return buttonInteraction.editReply({ embeds: [embeds.verificationRoleMissing()] });

                const roleMappings = guildDBData.role_mappings || {};

                try {
                    await interaction.guild.members.fetch();

                    let affectedMembers = 0;
                    let removedRoles = 0;

                    for(const member of interaction.guild.members.cache.values()) {
                        if(!member.roles.cache.has(guildDBData.verification_role)) 
                            continue;

                        const rolesToRemove = Object.values(roleMappings)
                            .map(r => r.discord_role_id)
                            .filter(rid => rid && member.roles.cache.has(rid));

                        if(rolesToRemove.length > 0) {
                            await member.roles.remove(rolesToRemove);
                            affectedMembers++;
                            removedRoles += rolesToRemove.length;
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