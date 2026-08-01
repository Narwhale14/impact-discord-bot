const { EmbedBuilder } = require('discord.js');
const { getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const { getOpenApplication, deleteOpenApplication } = require('../../utils/DBManagers/openApplicationsManager.js');
const { getProfileSkyblockLevelByUUID } = require('../../utils/APIManagers/hypixelAPIManager.js')
const { getEligibleRoleId } = require('../../utils/roleHelpers.js');
const embeds = require('../embeds.js');

module.exports = {
    customId: 'accept_request_button',
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 });
        const logsMessageId = interaction.message.id;
        const app = await getOpenApplication(logsMessageId);
        if(!app) return interaction.editReply({ embeds: [embeds.errorEmbed('Application not found!')] });

        const guildDBData = await getGuildData(interaction.guild);
        const roleId = guildDBData?.guild_member_role;
        if(!roleId) return interaction.editReply({ embeds: [embeds.errorEmbed(`Unable to locate guild member role.\nPlease ping a staff for help.`)] });

        try {
            const member = await interaction.guild.members.fetch(app.discord_user_id);
            if(!member) throw new Error('Applicant is not in this server.');

            await member.roles.add(roleId);
            await deleteOpenApplication(logsMessageId);

            const { level } = await getProfileSkyblockLevelByUUID(app.hypixel_uuid, app.profile_name);
            const eligibleRole = getEligibleRoleId(guildDBData.role_mappings, level);
            if(eligibleRole) await member.roles.add(eligibleRole.discord_role_id);

            const updateEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setTitle(`✅ Accepted`)
                .setColor(embeds.SUCCESS_COLOR);

            await interaction.message.edit({ embeds: [updateEmbed], components: [] })

            const user = await interaction.client.users.fetch(app.discord_user_id);

            try {
                await user.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Guild Application Result')
                            .setDescription('✅ Your application was accepted!\nYour account was automatically linked. If you wish to be unlinked, or to understand why you were linked, take a look at these commands:')
                            .addFields(
                                { name: 'Link in-game profile with:', value: '`/link <profile name>`' },
                                { name: 'Unlink in-game profile:', value: '`/unlink`'},
                                { name: 'Update role based on guild rank:', value: '`/role update`' },
                                { name: 'View rank requirements', value: '/role reqs' })
                            .setColor(embeds.SUCCESS_COLOR)
                            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                            .setTimestamp()
                    ]
                });
            } catch {}

            await interaction.editReply({ embeds: [embeds.successEmbed(`Accepted <@${app.discord_user_id}>'s application.`, embeds.SUCCESS_COLOR)], allowedMentions: { users: [] } });
        } catch (err) {
            console.error("Failed handling accept button: ", err);
            await interaction.editReply({ embeds: [embeds.errorEmbed('An error occurred while accepting this application.', err.message)] });
        }
    }
}