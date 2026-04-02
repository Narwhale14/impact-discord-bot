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
    client.buttons.set(button.customId, button);
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

client.on('interactionCreate', async interaction => {
    if(interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        if(command.adminOnly && !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
           await interaction.reply({ embeds: [embeds.errorEmbed('This command is restricted to admin only!')], flags: 64 });

        try { 
            await command.execute(interaction);
        } catch(err) {
            console.error(err);
            await interaction.reply({ embeds: [embeds.errorEmbed('Error handling command: ', err)], flags: 64 });
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
            await interaction.reply({ embeds: [embeds.errorEmbed('Error handling button: ', err)], flags: 64 });
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

            if(interaction.replied || interaction.deferred)
                await interaction.followUp({ embeds: [embeds.errorEmbed('Error handling modal: ', err)], flags: 64 });
            else 
                await interaction.reply({ embeds: [embeds.errorEmbed('Error handling modal: ', err)], flags: 64 });
        }
    }
});

// Login
client.login(process.env.DISCORD_TOKEN);