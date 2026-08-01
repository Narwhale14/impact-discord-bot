const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const { getProfileSkyblockLevelByUUID, isPlayerInGuild, getPlayerByName } = require('../../utils/APIManagers/hypixelAPIManager.js');
const { getUUIDFromName } = require('../../utils/APIManagers/minecraftAPIManager.js');
const { updateOpenApplications, getOpenApplicationFromPlayerName } = require('../../utils/DBManagers/openApplicationsManager.js');
const { updateLinkedPlayers } = require('../../utils/DBManagers/linkedPlayersManager.js');
const embeds = require('../embeds.js');

module.exports = {
    customId: 'apply_modal',
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const guildDBData = await getGuildData(interaction.guild);
        const logsChannel = interaction.guild.channels.cache.get(guildDBData?.logs_channel_id);
        if(!logsChannel || !logsChannel.isTextBased())
            return interaction.editReply({ embeds: [embeds.errorEmbed(`Unable to notify staff about your application\nPlease ping a staff for help.`)] });

        const name = interaction.fields.getTextInputValue('minecraft_user_input');
        const profileName = interaction.fields.getTextInputValue('skyblock_profile_name');

        const findOpenApplication = await getOpenApplicationFromPlayerName(guildDBData.id, name);
        if(findOpenApplication) return interaction.editReply({ embeds: [embeds.errorEmbed('This player already has an application up!')] });

        const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_request_button`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`deny_request_button`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        const mainEmbed = new EmbedBuilder()
            .setTitle(`New Application!`)
            .setDescription(`Application for <@${interaction.user.id}>`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor(embeds.WARNING_COLOR)
            .setTimestamp();

        try {
            const uuid = await getUUIDFromName(name);
            const inGuild = await isPlayerInGuild(uuid, guildDBData?.hypixel_guild_id);
            if(inGuild) return interaction.editReply({ embeds: [embeds.errorEmbed('You are already in the guild!')] });

            // check for linked player. what i have:
            // guildDBData
            // logsChannel
            // minecraft name (input, could be wrong)
            // minecraft profile (input , could be wrong)
            // player uuid

            // what i need
            // discord id (yes, interaction.user.id)
            // player uuid
            // player name (can use input)
            // guild id (serial)

            // need to check if the username they put in is legit, ie check if they have discord linked on hypixel
            // need: player API data

            // fetch player data from API
            const player = await getPlayerByName(name);
            if(!player) 
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Minecraft player with username **${name}** does not exist!`)] });

            const connectionTutorial = 'Go to Hypixel Lobby → player head in hotbar → Social Media → Discord';
            const playerDiscord = player.socialMedia?.links?.DISCORD;
            if(!playerDiscord) 
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Minecraft player with username **${name}** does not have a Discord linked.\nPlease fix:` + connectionTutorial)] });
            if(!playerDiscord.toLowerCase().trim().includes(interaction.user.username.toLowerCase().trim())) {
                mainEmbed.addFields({
                    name: '⚠️ Discord mismatch',
                    value: `Discord linked on Hypixel: **${playerDiscord}**\nDiscord used to apply: **${interaction.user.username}**`
                });

                interaction.user.send({ embeds: [embeds.errorEmbed(
                    `We noticed your Discord linked on Hypixel account '**${name}**' does not match your Discord account.\n` +
                    `That account's currently linked Discord on hypixel is: **${playerDiscord}**\n` +
                    `Your Discord: **${interaction.user.username}**\n\n` +
                    `If this is your account, you may need to reconnect your discord this way:\n` +
                    connectionTutorial)] 
                }).catch(() => {});
            }

            // upsert linked player
            await updateLinkedPlayers({ 
                discordId: interaction.user.id,
                hypixelUUID: player.uuid, 
                hypixelName: player.displayname, 
                guildDataId: guildDBData.id 
            });

            const profileData = await getProfileSkyblockLevelByUUID(uuid, profileName);
            mainEmbed.addFields(
                { name: 'Minecraft Username', value: `**${name}**` },
                { name: 'Skyblock Profile', value: `**${profileData.profile}**` },
                { name: 'Skyblock Level', value: `**${profileData.level}**` }
            )

            const appMessage = await logsChannel.send({ 
                content: `<@&${guildDBData.application_ping}>`,
                embeds: [mainEmbed], 
                components: [buttonRow],
                allowedMentions: { roles: [guildDBData.application_ping] }
            });

            await updateOpenApplications({
                guildDataId: guildDBData.id,
                logsMessageId: appMessage.id,
                discordUserId: interaction.user.id,
                minecraftName: name,
                profileName: profileName,
                hypixelUUID: player.uuid
            });

            return interaction.editReply({ embeds: [embeds.successEmbed('Guild application submitted!\nA staff member will review shortly.', interaction.guild.members.me.displayHexColor, 'SUBMITTED')], flags: 64 });
        } catch (err) {
            await logsChannel.send({ embeds: [embeds.errorEmbed(`Failed to apply user <@${interaction.user.id}>.`, err.message)] });
            return interaction.editReply({ embeds: [embeds.errorEmbed('Failed to apply.\nPlease ping staff for help.')], flags: 64 });
        }
    }
}