const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { updateGuildColumn, getGuildData } = require('../../utils/DBManagers/guildDataManager.js');
const embeds = require('../../interactions/embeds.js');

/**
 * @command - /app
 * guildappchannel stuff
 * 
 * /app logrolerequests
 * /app sendprompt
 * 
 * /app set logs
 * /app set memberrole
 * /app set staffping
 * 
 * /app unset logs
 * /app unset memberrole
 * /app unset staffping
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('app')
        .setDescription('Manages server guild applications and mod stuff')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(group => group.setName('set').setDescription('sets stuff')
            .addSubcommand(sub => sub
                .setName('logs')
                .setDescription('Sets the guild application logs channel')
                .addChannelOption(option => option.setName('channel').setDescription('Channel for staff to review applications').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('memberrole')
                .setDescription('Sets the guild member role')
                .addRoleOption(option => option.setName('role').setDescription('Guild member role').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('staffping')
                .setDescription('Sets the role to ping staff for applications & requests')
                .addRoleOption(option => option.setName('role').setDescription('Ping role').setRequired(true))))
        .addSubcommandGroup(group => group.setName('unset').setDescription('unsets stuff')
            .addSubcommand(sub => sub
                .setName('logs')
                .setDescription('Clears connection to the guild application logs channel'))
            .addSubcommand(sub => sub
                .setName('memberrole')
                .setDescription('Clears guild member role'))
            .addSubcommand(sub => sub
                .setName('staffping')
                .setDescription('Clears application & requests ping role')))
        .addSubcommand(sub => sub
            .setName('rolerequests')
            .setDescription('Turns on role requests (no ping)')
            .addBooleanOption(option => option.setName('on').setDescription('On/Off').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('sendprompt')
            .setDescription('Sends a guild application prompt')
            .addChannelOption(option => option.setName('channel').setDescription('Channel to send the prompt in').setRequired(true))),
        adminOnly: true,
    async execute(interaction) {
        await interaction.deferReply();
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        const guildDBData = await getGuildData(interaction.guild);

        // set subcommands
        if(group === 'set') {
            if(sub === 'logs') {
                const channel = interaction.options.getChannel('channel');
                if(!channel || !channel.isTextBased()) return interaction.editReply({ embeds: [embeds.errorEmbed(`Invalid discord channel.`)] });

                try {
                    await updateGuildColumn(interaction.guild, 'logs_channel_id', channel.id);
                    await interaction.editReply({ embeds: [embeds.successEmbed(`Guild logs channel set successfully to <#${channel.id}>!`, interaction.guild.members.me.displayHexColor)] });
                } catch(err) {
                    console.error("Failed running '/app set logs': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed(`An error occurred while setting guild logs channel.`, err.message)] });
                } 
            }

            if(sub === 'memberrole') {
                if(guildDBData?.guild_member_role) 
                    return interaction.reply({ embeds: [embeds.errorEmbed(`The guild member role is already set to <@&${guildDBData.guild_member_role}>.`)], allowedMentions: { roles: [] }});
                const applyRole = interaction.options.getRole('role');
                if(!applyRole) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed('Invalid role!')] });

                try {
                    await updateGuildColumn(interaction.guild, 'guild_member_role', applyRole.id);
                    await interaction.editReply({ embeds: [embeds.successEmbed(`Guild member role set successfully to <@&${applyRole.id}>!`, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
                } catch(err) {
                    console.error("Failed running '/app set role': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while setting guild member role.", err.message)] });
                } 
            }

            if(sub === 'staffping') {
                if(guildDBData?.application_ping) 
                    return interaction.reply({ embeds: [embeds.errorEmbed(`The application ping role is already set to <@&${guildDBData.application_ping}>.`)], allowedMentions: { roles: [] }});
                const applyRole = interaction.options.getRole('role');
                if(!applyRole) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed('Invalid role!')] });

                try {
                    await updateGuildColumn(interaction.guild, 'application_ping', applyRole.id);
                    await interaction.editReply({ embeds: [embeds.successEmbed(`Application ping role set successfully to <@&${applyRole.id}>!`, interaction.guild.members.me.displayHexColor)], allowedMentions: { roles: [] } });
                } catch(err) {
                    console.error("Failed running '/app set ping': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while setting application ping role.", err.message)] });
                } 
            }
        }

        // apps channel/logs clear subcommands
        if(group === 'unset') {
            if(sub === 'logs') {
                if(!guildDBData?.logs_channel_id) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed(`Guild logs channel not set yet!`)] });
                if(guildDBData?.requests_enabled)
                    await updateGuildColumn(interaction.guild, 'requests_enabled', false);

                try {
                    await updateGuildColumn(interaction.guild, 'logs_channel_id', null);
                    await interaction.editReply({ embeds: [embeds.successEmbed(`Guild logs channel connection cleared.`, interaction.guild.members.me.displayHexColor)] });
                } catch(err) {
                    console.error("Failed running '/apps <subcommandGroup> clear': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed(`An error occurred while clearing guild logs channel.`, err.message)] });
                } 
            }

            if(sub === 'memberrole') {
                if(!guildDBData?.guild_member_role) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed('Guild member role does not exist!')] });
                
                try {
                    await updateGuildColumn(interaction.guild, 'guild_member_role', null);
                    await interaction.editReply({ embeds: [embeds.successEmbed('Set guild member role cleared.', interaction.guild.members.me.displayHexColor)] });
                } catch(err) {
                    console.error("Failed running '/application clearrole': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while clearing guild member role.", err.message)] });
                } 
            }

            if(sub === 'staffping') {
                if(!guildDBData?.application_ping) 
                    return interaction.editReply({ embeds: [embeds.errorEmbed('Application ping role does not exist!')] });
                
                try {
                    await updateGuildColumn(interaction.guild, 'application_ping', null);
                    await interaction.editReply({ embeds: [embeds.successEmbed('Set application ping role cleared.', interaction.guild.members.me.displayHexColor)] });
                } catch(err) {
                    console.error("Failed running '/application clearping': ", err);
                    await interaction.editReply({ embeds: [embeds.errorEmbed("An error occurred while clearing application ping role.", err.message)] });
                } 
            }
        }

        if(sub === 'rolerequests') {
            const rolesToggle = interaction.options.getBoolean('on');
            if(guildDBData?.requests_enabled === rolesToggle) 
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Already toggled to **${rolesToggle}**!`)] });
            if(!guildDBData?.logs_channel_id)
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Logs channel not configured!\nPlease run: \`/applications log set <#channel>\``)] });
            try {
                await updateGuildColumn(interaction.guild, 'requests_enabled', rolesToggle);
                await interaction.editReply({ embeds: [embeds.successEmbed(`Toggled role requests to **${rolesToggle}**!\nThey will be sent in <#${guildDBData.logs_channel_id}>`, interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                console.error("Failed running '/apps log roles'", err);
                await interaction.editReply({ embeds: [embeds.errorEmbed(`An error occured while toggling role logs!`, err.message)] });
            }
        }

        if(sub === 'sendprompt') {
            const channel = interaction.options.getChannel('channel');
            if(!guildDBData?.guild_member_role) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Application role does not exist!\nPlease run: \`/applications setrole <role>\`')] });
            if(!guildDBData?.logs_channel_id) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('No channel set to send application notifications to!\nPlease run: \`/applications log set <channel>\`')] });
            if(!guildDBData?.application_ping) 
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Application ping role does not exist!\nPlease run: \`/applications setping <role>\``)] });
            if(!channel || !channel.isTextBased()) 
                return interaction.editReply({ embeds: [embeds.errorEmbed('Please select a **text** channel')] });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('apply_button').setLabel('Apply').setStyle(ButtonStyle.Success)
            );

            const applicationEmbed = new EmbedBuilder()
                .setTitle(`Create Application`)
                .setDescription(`Join the Significant Impact guild!`)
                .setColor(interaction.guild.members.me.displayHexColor)

            try {
                await channel.send({ embeds: [applicationEmbed], components: [row] });
                await interaction.editReply({ embeds: [embeds.successEmbed(`Application message created successfully in ${channel}`, interaction.guild.members.me.displayHexColor)] });
            } catch(err) {
                console.error("Failed running '/applications message create': ", err);
                return interaction.editReply({ embeds: [embeds.errorEmbed(`Unable to send message in this channel!\nCheck my bot perms and double check that I have message perms in ${channel}!`, err.message)] });
            }
        }
    }
}