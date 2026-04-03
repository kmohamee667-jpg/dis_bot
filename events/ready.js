const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const { loadPermissions } = require('../utils/configDb');
const timerManager = require('../utils/timerManager');
const { loadThemes } = require('../utils/themesDb');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        console.log(`🟢 Logged in as ${client.user.tag}! Ready on ${client.guilds.cache.size} servers.`);

        await loadPermissions();

        // 🔄 استعادة التايمرات من قاعدة البيانات
        await timerManager.restoreTimersFromDb();

        // Pre-load themes so slash command choices are available
        await loadThemes();

        client.commands = new Collection();
        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                // Rebuild command data now that themes are cached (e.g. challenge command)
                if (typeof command.buildData === 'function') {
                    command.data = command.buildData();
                }
                client.commands.set(command.data.name, command);
                console.log(`📱 Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ Skipping invalid command: ${filePath}`);
            }
        }

        console.log(`✅ Commands loaded!`);
    }
};
