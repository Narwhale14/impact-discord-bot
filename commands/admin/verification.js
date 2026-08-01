const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType } = require('discord.js');
const { getGuildData, updateGuildColumn } = require('../../utils/DBManagers/guildDataManager.js');
const embeds = require('../../interactions/embeds.js');

/**
 * @command - /editverifymessage
 * directly edits a verification message in a specific channel by ID and channel
 * can also set/clear verification role
 * 
 * /verification send
 * /verification delete
 * /verification setrole
 * /verification clearrole
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('verification')
        .setContexts(InteractionContextType.Guild)
        .setDescription('initialize and create verifcation message')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('send')
            .setDescription('Sends a verification prompt')
            .addChannelOption(option => option.setName('channel').setDescription('Channel to send the prompt in').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('clearrole')
            .setDescription('Clears verification role'))
        .addSubcommand(sub => sub
            .setName('setrole')
            .setDescription('Sets role to use for verification')
            .addRoleOption(option => option.setName('role').setDescription('Role of choice').setRequired(true))),
        adminOnly: true,
    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        const guildDBData = await getGuildData(interaction.guild);

        // send subcommand
        if(subcommand === 'send') {
            const channel = interaction.options.getChannel('channel');
            if(!guildDBData?.verification_role) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Verification role does not exist!')] });
            if(!channel || !channel.isTextBased()) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Please select a **text** channel')] });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('verify_button').setLabel('Verify').setStyle(ButtonStyle.Success)
            );

            const verifyEmbed = new EmbedBuilder()
                .setTitle(`Verification`)
                .setDescription(`Gain access to the rest of the server!`)
                .setColor(interaction.guild.members.me.displayHexColor)

            try {
                await channel.send({ embeds: [verifyEmbed], components: [row] });
                await interaction.editReply({ embeds: [embeds.successEmbed(`Verification message created successfully in ${channel}`, interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                return interaction.editReply({ embeds: [embeds.errorEmbed('Reference message ID invalid or not in this channel!')] });
            }
        }

        // setrole subcommand
        if(subcommand == 'setrole') {
            if(guildDBData?.verification_role)
                return interaction.editReply({ embeds: [embeds.errorEmbed(`The verification role is already set to <@&${guildDBData.verification_role}>.`)], allowedMentions: { roles: [] }});
            const verificationRole = interaction.options.getRole('role');
            if(!verificationRole) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Invalid role!')] });

            try {
                await updateGuildColumn(interaction.guild, 'verification_role', verificationRole.id);
                await interaction.editReply({ embeds: [embeds.successEmbed(`Verification role set successfully to <@&${verificationRole.id}>!`, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
            } catch(err) {
                console.error("Failed running '/verification setrole': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while setting verification role.", err.message)] });
            } 
        }

        // clearrole subcommand
        if(subcommand == 'clearrole') {
            if(!guildDBData?.verification_role) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Verification role does not exist!')] });

            try {
                await updateGuildColumn(interaction.guild, 'verification_role', null);
                await interaction.editReply({ embeds: [embeds.successEmbed('Set verification role cleared.', interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                console.error("Failed running '/verification clearrole': ", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while clearing verification role.", err.message)] });
            } 
        }
    }
};