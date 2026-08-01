const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType } = require('discord.js');
const { createPageEmbed, flattenCommands } = require('../../utils/helpBuilders.js');
const embeds = require('../../interactions/embeds');

/**
 * @command - /helpadmin
 * displays list of admin commands
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('helpadmin')
        .setContexts(InteractionContextType.Guild)
        .setDescription('Lists all available admin commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        adminOnly: true,
    async execute(interaction) {
        const userType = 'Admin';
        const flattenedCommands = [...interaction.client.commands.values()]
            .sort((a, b) => a.data.name.localeCompare(b.data.name))
            .filter(cmd => cmd.adminOnly)
            .flatMap(flattenCommands);
        if(flattenedCommands.length === 0) return interaction.reply({ embeds: [embeds.errorEmbed('No admin commands found.')] });

        const fieldsPerPage = 10;
        const pages = [];
        for(let i = 0; i < flattenedCommands.length; i += fieldsPerPage) {
            pages.push(flattenedCommands.slice(i, i + fieldsPerPage));
        }

        let currentPage = 0;

        const createNavigationRow = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('help_prev')
                .setLabel('⬅ Prev')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('help_next')
                .setLabel('Next ➡')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === pages.length - 1)
        );

        const components = pages.length > 1 ? [createNavigationRow()] : [];

        await interaction.reply({
            embeds: [createPageEmbed(interaction, pages[currentPage], currentPage, pages.length, userType)],
            components
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });

        collector.on('collect', async btnInteraction => {
            if(btnInteraction.user.id !== interaction.user.id) {
                return btnInteraction.reply({ content: 'You cannot control this help menu.', flags: 64 });
            }

            if(btnInteraction.customId === 'help_next')
                currentPage = (currentPage + 1) % pages.length;
            else if(btnInteraction.customId === 'help_prev')
                currentPage = (currentPage - 1 + pages.length) % pages.length;

            await btnInteraction.update({
                embeds: [createPageEmbed(interaction, pages[currentPage], currentPage, pages.length, userType)],
                components: [createNavigationRow()]
            });
        });

        collector.on('end', async () => { 
            await message.edit({ components: [] })
        });
    }
}