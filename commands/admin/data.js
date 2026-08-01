const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const { countLinkedPlayers } = require('../../utils/DBManagers/linkedPlayersManager.js');
const embeds = require('../../interactions/embeds.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('data')
        .setContexts(InteractionContextType.Guild)
        .setDescription('Gets list of server-applied data')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        adminOnly: true,
    async execute(interaction) {
        const guildDBData = await getGuildData(interaction.guild);
        const linkedCount = await countLinkedPlayers(guildDBData.id);

        const listEmbed = new EmbedBuilder()
            .setTitle('List of Server Data')
            .setDescription('All data set via admin commands')
            .setColor(interaction.guild.members.me.displayHexColor)
            .setTimestamp()

        for(const [key, value] of Object.entries(guildDBData)) {
            listEmbed.addFields({
                name: key,
                value: value !== null && value !== undefined ? `${value}` : 'None',
                inline: true
            });
        }

        listEmbed.addFields({ name: 'linked_players', value: `${linkedCount}`, inline: true });

        return interaction.reply({ embeds: [listEmbed] });
    }
}