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

// register slash cmds
(async () => {
    try {
        console.log(`Registering ${commands.length} commands...`);
        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
        console.log('Commands registered successfully!');
    } catch(err) {
        console.error(err);
    }
})();