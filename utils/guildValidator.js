const { EmbedBuilder, MessageFlags } = require('discord.js');

/**
 * ✅ التحقق من Guild ID
 * @param {Interaction|Message} interaction
 * @returns {boolean} true إذا كان Guild ID صحيح
 */
async function validateGuild(interaction) {
    const allowedGuildId = process.env.GUILD_ID;
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

    // ❌ Guild ID غير متطابق
    if (allowedGuildId && currentGuildId !== allowedGuildId) {
        if (interaction.isRepliable?.()) {
            const embed = new EmbedBuilder()
                .setDescription('❌ **No Permission to work here!**\nهذا البوت يعمل فقط في السيرفر المخصص')
                .setColor('#FF8C00'); // برتقالي
            
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
