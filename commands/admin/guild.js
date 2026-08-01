const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder, InteractionContextType } = require('discord.js');
const { getGuildData, updateGuildColumn } = require('../../utils/DBManagers/guildDataManager.js');
const { getGuildByName } = require('../../utils/APIManagers/hypixelAPIManager.js');
const embeds = require('../../interactions/embeds.js');

/**
 * @command - /guild
 * Settings for discord guild and hypixel guild link
 * 
 * /guild link
 * /guild unlink
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('guild')
        .setContexts(InteractionContextType.Guild)
        .setDescription('Settings for discord guild and hypixel guild link')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('link')
            .setDescription('Link discord server to hypixel guild')
            .addStringOption(option => option.setName('guild').setDescription('Guild of choice').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('unlink')
            .setDescription('Unlink discord server to hypixel guild')),
        adminOnly: true,
        dangerousSubcommands: ['unlink'],
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const guildDBData = await getGuildData(interaction.guild);

        // link subcommand
        if(subcommand === 'link') {
            if(guildDBData?.hypixel_guild_id) return interaction.editReply({ embeds: [embeds.errorEmbed('This server is already linked to a Hypixel guild!')] });
            const guildName = interaction.options.getString('guild');

            try {
                const hypixelGuild = await getGuildByName(guildName);
                if(!hypixelGuild) return interaction.editReply({ embeds: [embeds.errorEmbed(`Guild **${guildName}** not found on Hypixel.`)] });

                await updateGuildColumn(interaction.guild, 'hypixel_guild_id', hypixelGuild._id);
                await interaction.editReply({ embeds: [embeds.successEmbed(`Successfully linked guild **${guildName}** to this server!`, interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                console.error("Failed running '/guild link': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while linking guild.", err.message)] });
            } 
        }

        // unlink subcommand
        if(subcommand === 'unlink') {
            if(!guildDBData?.hypixel_guild_id) 
                return interaction.editReply({ embeds: [embeds.guildNotLinked()] });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`confirm_unlink:${interaction.user.id}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId(`cancel_unlink:${interaction.user.id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            )

            const mainEmbed = new EmbedBuilder()
                .setTitle('⚠️ WARNING')
                .setDescription('Are you sure you want to unlink the guild?\n**You will have to relink in-game ranks.**')
                .setColor(embeds.WARNING_COLOR)
                .setTimestamp();
            await interaction.editReply({ embeds: [mainEmbed], components: [row] });

            const filter = i => i.user.id === interaction.user.id

            try {
                const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);

                if(!buttonInteraction) {
                    row.components.forEach(b => b.setDisabled(true));
                    mainEmbed.setTitle('ERROR').setDescription('Unlink timed out').setColor(embeds.ERROR_COLOR);
                    return interaction.editReply({ embeds: [mainEmbed], components: [] });
                }

                // atp button interaction is stored, disable buttons
                row.components.forEach(b => b.setDisabled(true));

                if(buttonInteraction.customId === `cancel_unlink:${interaction.user.id}`) {
                    mainEmbed.setTitle('Cancelled').setDescription('Unlink cancelled.').setColor(interaction.guild.members.me.displayHexColor)
                    return buttonInteraction.update({ embeds: [mainEmbed], components: [] });
                }

                if(buttonInteraction.customId === `confirm_unlink:${interaction.user.id}`) {
                    // run in parallel 
                    await Promise.all([
                        updateGuildColumn(interaction.guild.id, 'hypixel_guild_id', null),
                        updateGuildColumn(interaction.guild.id, 'role_mappings', null)
                    ]);

                    mainEmbed.setTitle('Success').setDescription(`Successfully unlinked any guild to this server!\nCleared linked roles!`).setColor(interaction.guild.members.me.displayHexColor);
                    await buttonInteraction.update({ embeds: [mainEmbed], components: [] });
                }
            } catch(err) {
                console.error("Failed running '/guild unlink': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while unlinking guild.", err.message)] });
            } 
        }
    }
}