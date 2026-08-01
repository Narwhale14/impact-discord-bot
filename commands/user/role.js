const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const { getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const { getLinkedPlayer } = require('../../utils/DBManagers/linkedPlayersManager.js');
const { getProfileSkyblockLevelByUUID, getMemberInGuildByPlayerUUID } = require('../../utils/APIManagers/hypixelAPIManager.js');
const { getEligibleRoleId, removeMappedRoles } = require('../../utils/roleHelpers.js');
const embeds = require('../../interactions/embeds.js');

/**
 * @command - /role
 * user commands relating to hypixel rank/discord roles
 * 
 * /role update
 * /role clear
 * /role reqs
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setContexts(InteractionContextType.Guild)
        .setDescription('User commands relating to hypixel rank/discord roles')
        .addSubcommand(sub => sub
            .setName('update')
            .setDescription('Updates guild rank and discord role')
            .addStringOption(option => option.setName('profile').setDescription('Option Skyblock profile name (e.g. Cucumber)').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('Clears associated guild rank role'))
        .addSubcommand(sub => sub
            .setName('reqs')
            .setDescription('Requirements for all guild ranks')),
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        const guildDBData = await getGuildData(interaction.guild);
        if(!guildDBData?.hypixel_guild_id) 
            return interaction.editReply({ embeds: [embeds.guildNotLinked()] });

        // update subcommand
        if(subcommand === 'update') {
            const linkedPlayer = await getLinkedPlayer(interaction.user.id, guildDBData.id);
            if(!linkedPlayer)
                return interaction.editReply({ embeds: [embeds.errorEmbed("You are not linked to the guild for this server.\nIf you believe you are in the guild, run `/link <minecraft username>`")] });
            
            const profileName = interaction.options.getString('profile');

            try {
                const { level, profile } = await getProfileSkyblockLevelByUUID(linkedPlayer.hypixel_uuid, profileName);
                const member = await getMemberInGuildByPlayerUUID(linkedPlayer.hypixel_uuid);
                if(!member || member.guild_id !== guildDBData.hypixel_guild_id)
                    return interaction.editReply({ embeds: [embeds.errorEmbed("You are not currently in this guild.")] });
                const inGameRank = member.rank.toUpperCase();

                /** available data from API:
                 *      player profile level
                 *      player profile name
                 *      player uuid
                 *      player guild rank
                 *      guild id
                 *      guild name
                 */

                const eligibleRole = getEligibleRoleId(guildDBData.role_mappings, level);
                if(!eligibleRole) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed(`No Discord role available for profile **${profile}** (level: ${level})`)] });

                const memberDiscord = await interaction.guild.members.fetch(interaction.user.id);
                await removeMappedRoles(memberDiscord, guildDBData.role_mappings);
                await memberDiscord.roles.add(eligibleRole.discord_role_id);
                
                // message builder
                let success = `Successfully updated role to <@&${eligibleRole.discord_role_id}> based on Skyblock profile **${profile}** (level: ${level})!`;
                if(inGameRank !== eligibleRole.rank && guildDBData.role_mappings[inGameRank] && guildDBData.requests_enabled === true) {
                    success += `\n\nCurrent in-game guild rank is **${inGameRank}**, expect to be changed to **${eligibleRole.rank}** soon!`;
                    const logsChannel = interaction.guild.channels.cache.get(guildDBData?.logs_channel_id);
                    if(!logsChannel || !logsChannel.isTextBased())
                        return interaction.editReply({ embeds: [embeds.errorEmbed(`Unable to notify staff about your role update\nPlease ping a staff for help.`)] });
                        
                    const logsEmbed = new EmbedBuilder()
                        .setTitle(`New Role Update!`)
                        .setDescription(`<@${interaction.user.id}>'s role has upgraded to <@&${eligibleRole.discord_role_id}>\n When available, promote them in-game to **${eligibleRole.rank}**`)
                        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 1024 }))
                        .setColor(embeds.SUCCESS_COLOR)
                        .setTimestamp();

                    logsChannel.send({
                        content: `<@&${guildDBData.application_ping}>`,
                        embeds: [logsEmbed],
                        allowedMentions: { roles: [guildDBData.application_ping] }
                    });
                } else if(guildDBData.role_mappings[inGameRank] && guildDBData.requests_enabled === false) {
                    success += `\n\nThis guild has Hypixel rank update notifications disabled, try asking someone capable in-game to get it!`
                }

                return interaction.editReply({ embeds: [embeds.successEmbed(success, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
            } catch(err) {
                console.error("Failed running '/role update': ", err);

                if(err.message.includes("Profile") && err.message.includes("not found")) {
                    return interaction.editReply({ embeds: [embeds.errorEmbed(err.message)] });
                }

                return interaction.editReply({ embeds: [embeds.errorEmbed('An error occured while updating your role.')] });
            }
        }

        // clear subcommand
        if(subcommand === 'clear') {
            const roleMappings = guildDBData.role_mappings || {};
            const memberDiscord = interaction.guild.members.cache.get(interaction.user.id);
            let cleared = false;

            try {
                for(const rankObj of Object.values(roleMappings)) {
                    const rid = rankObj.discord_role_id;
                    if(rid && memberDiscord.roles.cache.has(rid)) {
                        await memberDiscord.roles.remove(rid);
                        cleared = true;
                    }
                }
            } catch(err) {
                console.error("Failed running '/role clear': ", err);
                return interaction.editReply({ embeds: [embeds.errorEmbed('An error occured while clearing your role.')] });
            }

            let success = '';
            if(cleared) 
                success = `Successfully cleared all rank roles.\nTo sync in-game rank again, run \`/updaterole\``;
            else 
                success = 'No rank to clear!';

            return interaction.editReply({ embeds: [embeds.successEmbed(success, interaction.guild.members.me.displayHexColor)] });
        }

        // reqs subcommand
        if(subcommand === 'reqs') {
            const roleMappings = guildDBData.role_mappings;
            const sortedRoles = Object.entries(roleMappings)
                .sort((a, b) => b[1].level_requirement - a[1].level_requirement);

            let description = '';
            for(const [rank, data] of sortedRoles) {
                description += 
                    `<@&${data.discord_role_id}> - **${rank}**` +
                    `\n↳ Skyblock Level **${data.level_requirement}**\n\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('Guild Role Requirements')
                .setColor(interaction.guild.members.me.displayHexColor)
                .setDescription(description)
                .setFooter({ text: `Requirements are based on Skyblock Profile level` })

            return interaction.editReply({ embeds: [embed], allowedMentions: { roles: [] } });
        }
    }
}