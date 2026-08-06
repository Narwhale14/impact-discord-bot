const { EmbedBuilder } = require('discord.js');
const embeds = require('../embeds.js');

module.exports = {
    customId: 'role_update_complete_button',
    async execute(interaction) {
        const [roleLine] = (interaction.message.embeds[0]?.description || '').split('\n');

        const completedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(`${roleLine}\nRole Updated by <@${interaction.user.id}>`)
            .setColor(embeds.SUCCESS_COLOR);

        await interaction.update({ embeds: [completedEmbed], components: [] });
    }
}
