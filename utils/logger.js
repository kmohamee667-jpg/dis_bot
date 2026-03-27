const { EmbedBuilder } = require('discord.js');

const LOG_CHANNEL_NAME = '♕・𝐋𝐨𝐠・لوج';

/**
 * 
 * @param {import('discord.js').Client} client 
 * @param {string} guildId 
 * @param {object} logData 
 */
async function logAction(client, guildId, logData) {
    try {
        if (!guildId) return;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        // البحث عن القناة بالاسم
        const logChannel = guild.channels.cache.find(c => c.name === LOG_CHANNEL_NAME);
        if (!logChannel) {
            console.warn(`[Logger] Channel ${LOG_CHANNEL_NAME} not found in guild ${guild.name}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(logData.title || 'System Log')
            .setColor(logData.color || '#F1C40F')
            .setTimestamp()
            .setFooter({ text: 'GALAXY SYSTEM LOGS', iconURL: client.user.displayAvatarURL() });

        if (logData.fields) {
            embed.addFields(logData.fields);
        } else if (logData.description) {
            embed.setDescription(logData.description);
        }

        if (logData.user) {
            embed.setAuthor({ 
                name: logData.user.username, 
                iconURL: logData.user.displayAvatarURL() 
            });
        }

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[Logger Error]', error);
    }
}

module.exports = { logAction };
