const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { loadThemes } = require('./utils/themesDb');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.options.timeout = 60000; // Force timeout setting

(async () => {
    try {
        // Pre-load themes so slash command choices (e.g. challenge theme picker) are populated
        await loadThemes();

        const commands = [];
        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                // Rebuild command data now that themes are cached
                const data = typeof command.buildData === 'function' ? command.buildData() : command.data;
                commands.push(data.toJSON());
            }
        }

        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
        const clientId = '1468926065853468672';
        const guildId = process.env.GUILD_ID || '1476589188932440094';
        
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        
        console.log(`✅ Successfully deployed ${commands.length} slash commands to Guild: ${guildId}`);
    } catch (error) {
        console.error(error);
    }
})();


