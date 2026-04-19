const { readdirSync } = require('fs');
const path = require('path');
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        const allowedGuildId = process.env.GUILD_ID;
        const content = message.content.trim();

        const commandsDir = path.join(__dirname, 'commands');
        const commandFiles = readdirSync(commandsDir).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const commandNameLatin = path.parse(file).name;
            const commandNameArabic = commandNameLatin === 'adi' ? 'ادي' : commandNameLatin === 'som' ? 'سم' : commandNameLatin === 'ban' ? 'بان' : commandNameLatin === 'unban' ? 'فك بان' : commandNameLatin === 'rm-all' ? '!rm-all' : commandNameLatin;
            
            if (content.startsWith(commandNameLatin + ' ') || content === commandNameLatin || content.startsWith(commandNameArabic + ' ') || content === commandNameArabic) {
                const command = require(path.join(commandsDir, file));
                await command.execute(message, client, allowedGuildId);
                return;
            }
        }

        // مسح keyword
        if (content === 'مسح' || content.startsWith('مسح ')) {
            const mas7Command = require('./commands/mas7');
            await mas7Command.execute(message, client, allowedGuildId);
        }
    }
};

