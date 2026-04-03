const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// جمع كل الأوامر
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

// إعداد REST
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.options.timeout = 60000;

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const clientId = '1468926065853468672';
        const guildIds = process.env.GUILD_IDS
            ? process.env.GUILD_IDS.split(',')
            : ['1476589188932440094'];

        // Loop على كل Guild
        for (const guildId of guildIds) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId.trim()),
                    { body: commands }
                );
                console.log(`✅ Deployed to Guild: ${guildId}`);
            } catch (err) {
                // تجاهل أي خطأ بسبب Missing Access أو غيره، واظهر رسالة
                if (err.code === 50001) {
                    console.warn(`⚠️ Missing Access for Guild: ${guildId}, skipped.`);
                } else {
                    console.error(`❌ Failed to deploy to Guild: ${guildId}`, err);
                }
            }
        }

        console.log(`✅ Finished deploying commands to all available Guilds.`);
    } catch (error) {
        console.error('Unexpected error while deploying commands:', error);
    }
})();