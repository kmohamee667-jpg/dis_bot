const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes } = require('discord.js');
const { loadPermissions } = require('../utils/configDb');
const timerManager = require('../utils/timerManager');

const CLIENT_ID = '1468926065853468672';

async function cleanupOldCommands(client, loadedCommandNames) {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    const guildId = process.env.GUILD_ID;

    // --- Guild commands cleanup ---
    if (guildId) {
        try {
            const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, guildId));
            const staleGuildCommands = guildCommands.filter(cmd => !loadedCommandNames.has(cmd.name));

            if (staleGuildCommands.length === 0) {
                console.log('✅ No stale guild commands to clean up.');
            } else {
                for (const cmd of staleGuildCommands) {
                    await rest.delete(Routes.applicationGuildCommand(CLIENT_ID, guildId, cmd.id));
                    console.log(`🗑️ Deleted stale guild command: /${cmd.name}`);
                }
            }
        } catch (error) {
            console.error('⚠️ Failed to clean up guild commands:', error.message);
        }
    }

    // --- Global commands cleanup ---
    try {
        const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
        const staleGlobalCommands = globalCommands.filter(cmd => !loadedCommandNames.has(cmd.name));

        if (staleGlobalCommands.length === 0) {
            console.log('✅ No stale global commands to clean up.');
        } else {
            for (const cmd of staleGlobalCommands) {
                await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
                console.log(`🗑️ Deleted stale global command: /${cmd.name}`);
            }
        }
    } catch (error) {
        console.error('⚠️ Failed to clean up global commands:', error.message);
    }
}

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        console.log(`🟢 Logged in as ${client.user.tag}! Ready on ${client.guilds.cache.size} servers.`);

        await loadPermissions();

        // 🔄 استعادة التايمرات من قاعدة البيانات
        await timerManager.restoreTimersFromDb();

        client.commands = new Collection();
        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`📱 Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ Skipping invalid command: ${filePath}`);
            }
        }

        console.log(`✅ Commands loaded!`);

        // 🧹 Remove any Discord-registered commands that no longer exist as files
        const loadedCommandNames = new Set(client.commands.keys());
        await cleanupOldCommands(client, loadedCommandNames);
    }
};
