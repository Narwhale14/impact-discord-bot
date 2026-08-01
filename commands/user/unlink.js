const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { deleteLinkedPlayer, getLinkedPlayer } = require('../../utils/DBManagers/linkedPlayersManager.js');
const { getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const embeds = require('../../interactions/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlink')
        .setContexts(InteractionContextType.Guild)
        .setDescription('Unlinks your Hypixel account to your Discord'),
    async execute(interaction) {
        await interaction.deferReply();
        try {
            const targetUser = interaction.user;
            const guildDBData = await getGuildData(interaction.guild);

            const existingLink = await getLinkedPlayer(targetUser.id, guildDBData.id);
            if(!existingLink)
                return interaction.editReply({ embeds: [embeds.errorEmbed(`**${targetUser.username}** is not linked to any Hypixel Account.`)] });

            // delete from db
            await deleteLinkedPlayer(targetUser.id, guildDBData.id);
            await interaction.editReply({ embeds: [embeds.successEmbed(`Successfully unlinked **${existingLink.hypixel_name}** from your Discord account.`, interaction.guild.members.me.displayHexColor)] });
        } catch(err) {
            console.error("Error unlinking player: ", err);
            await interaction.editReply({ embeds: [embeds.errorEmbed("An error occured while unlinking the account.")] });
        }
    }
}