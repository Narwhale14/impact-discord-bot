require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, PermissionFlagsBits } = require('discord.js');
const embeds = require('./interactions/embeds');
const os = require('os');

console.log("BOT STARTED ON:", os.hostname());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// commands collection
client.commands = new Collection();
const loadCommands = (dir, category = null) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for(const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if(entry.isDirectory()) {
            if(entry.name.toLowerCase() === 'unused') continue;
            loadCommands(fullPath, entry.name);
        } else if(entry.name.endsWith('.js')) {
            const command = require(fullPath);
            if(!command.data) continue;
            client.commands.set(command.data.name, command);
        }
    }
}

loadCommands(path.join(__dirname, 'commands'));

// buttons collection
client.buttons = new Collection();
const buttonsPath = path.join(__dirname, 'interactions', 'buttons');
const buttonFiles = fs.readdirSync(buttonsPath).filter(file => file.endsWith('.js'));

for(const file of buttonFiles) {
    const button = require(`./interactions/buttons/${file}`);
    for(const id of button.customIds || [button.customId]) client.buttons.set(id, button);
}

// modals collection
client.modals = new Collection();
const modalsPath = path.join(__dirname, 'interactions', 'modals');
const modalFiles = fs.readdirSync(modalsPath).filter(file => file.endsWith('.js'));

for(const file of modalFiles) {
    const modal = require(`./interactions/modals/${file}`);
    client.modals.set(modal.customId, modal);
}

// ready event (bot comes online)
client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);
});

const respondWithError = async (interaction, message, err) => {
    const payload = { embeds: [embeds.errorEmbed(message, err?.message)], flags: 64 };

    try {
        if(interaction.deferred) await interaction.editReply(payload);
        else if(interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
    } catch(replyErr) {
        console.error('Failed to deliver error response: ', replyErr);
    }
}

client.on('interactionCreate', async interaction => {
    if(!interaction.guild) return;

    if(interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        if(command.adminOnly && !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
           return interaction.reply({ embeds: [embeds.errorEmbed('This command is restricted to admin only!')], flags: 64 });

        try {
            await command.execute(interaction);
        } catch(err) {
            console.error(err);
            await respondWithError(interaction, 'Error handling command.', err);
        }

        return;
    }

    if(interaction.isButton()) {
        const button = client.buttons.get(interaction.customId);
        if(!button) return;

        try {
            await button.execute(interaction);
        } catch(err) {
            console.error(err);
            await respondWithError(interaction, 'Error handling button.', err);
        }
        return;
    }

    if(interaction.isModalSubmit()) {
        const modal = client.modals.get(interaction.customId);
        if(!modal) return;

        try {
            await modal.execute(interaction);
        } catch(err) {
            console.error(err);
            await respondWithError(interaction, 'Error handling modal.', err);
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);