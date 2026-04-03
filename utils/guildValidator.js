const { EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * ✅ التحقق من Guild ID
 * @param {Interaction|Message} interaction
 * @returns {boolean} true إذا كان Guild ID صحيح
 */
async function validateGuild(interaction) {
    const allowedGuildIdsStr = process.env.GUILD_IDS || process.env.GUILD_ID || '';
    const allowedGuildIds = allowedGuildIdsStr.split(',').map(id => id.trim()).filter(Boolean);

    const currentGuildId = interaction.guildId;

    // ❌ لا guild ID
    if (!currentGuildId) {
        if (interaction.isRepliable?.()) {
            await interaction.reply({
                content: '❌ Invalid command',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }
        return false;
    }

    // ❌ Not in allowed guilds
    if (!allowedGuildIds.includes(currentGuildId)) {
        if (interaction.isRepliable?.()) {
            const embed = new EmbedBuilder()
                .setDescription(`❌ **No Permission!**\nالسيرفر غير مصرح له\nالسيرفرات: ${allowedGuildIds.join(', ')}`)
                .setColor('#FF8C00');
            
            await interaction.reply({
                embeds: [embed],
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }
        return false;
    }

    return true;
}

module.exports = { validateGuild };
