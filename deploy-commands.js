require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

const commands = [];
const loadCommands = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for(const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if(entry.isDirectory()) {
            if(entry.name.toLowerCase() === 'unused') continue;

            loadCommands(fullPath);
        } else if(entry.name.endsWith('.js')) {
            const command = require(fullPath);
            if(!command.data) continue;
            console.log(`Loaded command: ${command.data.name}`);
            commands.push(command.data.toJSON());
        }
    }
};

loadCommands(path.join(__dirname, 'commands'));

const mode = (process.argv[2] || 'guild').replace(/^--/, '');

(async () => {
    if(!process.env.CLIENT_ID) return console.error('CLIENT_ID is not set.');
    if(mode !== 'global' && !process.env.GUILD_ID) return console.error(`Mode '${mode}' needs GUILD_ID set.`);

    try {
        if(mode === 'global') {
            console.log(`Registering ${commands.length} commands globally...`);
            await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
            console.log('Registered globally. May take up to an hour to appear everywhere.');
        } else if(mode === 'clear') {
            console.log(`Clearing guild commands from ${process.env.GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [] });
            console.log('Guild commands cleared.');
        } else if(mode === 'guild') {
            console.log(`Registering ${commands.length} commands to guild ${process.env.GUILD_ID}...`);
            await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
            console.log('Registered to guild.');
        } else {
            console.error(`Unknown mode '${mode}'. Use: guild (default) | global | clear`);
        }
    } catch(err) {
        console.error(err);
    }
})();