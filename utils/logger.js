const { EmbedBuilder } = require('discord.js');

// Constants for Galactic Log Configuration
const LOG_GUILD_ID = '1476589188932440094';
const LOG_CHANNEL_ID = '1487356907059548220';

/**
 * Sends a detailed log message to the designated log channel.
 * 
 * @param {import('discord.js').Client} client 
 * @param {string} guildId - The guild where the action occurred
 * @param {object} logData - Information to include in the log
 */
async function logAction(client, guildId, logData) {
    try {
        // Fetch the specific logging guild and channel
        const guild = await client.guilds.fetch(LOG_GUILD_ID).catch(() => null);
        if (!guild) {
            console.error(`[Logger] Could not fetch log guild with ID: ${LOG_GUILD_ID}`);
            return;
        }

        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) {
            console.error(`[Logger] Could not fetch log channel with ID: ${LOG_CHANNEL_ID}`);
            return;
        }

        // --- Arabic Timestamp Formatting ---
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        const arabicDate = now.toLocaleString('ar-EG', options);

        const embed = new EmbedBuilder()
            .setTitle(logData.title || '🛰️ سجل النظام العام')
            .setColor(logData.color || '#F1C40F')
            .setDescription(logData.description || null)
            .setTimestamp()
            .setFooter({ 
                text: `GALAXY LOGS | ${arabicDate}`, 
                iconURL: client.user.displayAvatarURL() 
            });

        // Add User Info if available
        if (logData.user) {
            embed.setAuthor({ 
                name: `${logData.user.username} (${logData.user.id})`, 
                iconURL: logData.user.displayAvatarURL() 
            });
            embed.setThumbnail(logData.user.displayAvatarURL());
        }

        // Add Fields
        if (logData.fields && logData.fields.length > 0) {
            embed.addFields(logData.fields);
        }

        // Send the log
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[Logger Error]', error);
    }
}

module.exports = { logAction };
