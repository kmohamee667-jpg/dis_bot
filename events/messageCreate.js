const { EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../utils/admin-check');
const { logAction } = require('../utils/logger');
const timerManager = require('../utils/timerManager');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bots
        if (message.author.bot) return;

        const allowedGuildId = process.env.GUILD_ID;
        const content = message.content.trim();

        // ─── Keyword: مسح ──────────────────────────────────────────────
        if (content === 'مسح' || content.startsWith('مسح ')) {
            
            // ✅ تحقق من Server ID - اجبر استخدام السيرفر المحدد فقط
            if (allowedGuildId && message.guildId !== allowedGuildId) {
                return await message.reply({
                    content: '❌ **No Permission to work here!**\nهذا الأمر يعمل فقط في السيرفر المخصص',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
            }

            // 1. Permission check
            if (!isAdmin(message, 'مسح')) {
                const denyMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ You don't have permission to use this command.")
                            .setColor('#E74C3C')
                    ]
                }).catch(() => null);

                // Auto-delete the denial after 4 seconds — original message stays
                if (denyMsg) setTimeout(() => denyMsg.delete().catch(() => {}), 4000);
                return;
            }

            // 2. Parse count
            const parts = content.split(' ');
            let count = 100; // Default: delete up to 100 messages
            if (parts[1]) {
                const parsed = parseInt(parts[1]);
                if (!isNaN(parsed) && parsed > 0) {
                    count = Math.min(parsed, 100); // Discord API max per bulk-delete is 100
                }
            }

            // 3. Collect timer message IDs to protect (check both messageId and messageObj.id)
            const protectedIds = new Set();
            for (const [, timer] of timerManager.activeTimers) {
                if (timer.messageId)       protectedIds.add(String(timer.messageId));
                if (timer.messageObj?.id)  protectedIds.add(String(timer.messageObj.id));
            }

            // 4. Fetch messages
            await message.delete().catch(() => {}); // Delete the "مسح" command itself first

            let fetched;
            try {
                fetched = await message.channel.messages.fetch({ limit: count });
            } catch (e) {
                console.error('[مسح] Failed to fetch messages:', e);
                return;
            }

            // 5. Filter out protected timer messages
            const toDelete = fetched.filter(msg => !protectedIds.has(msg.id));

            // 6. Bulk delete (discord only allows messages < 14 days old)
            let deletedCount = 0;
            try {
                const bulkDeleted = await message.channel.bulkDelete(toDelete, true); // true = filter old messages
                deletedCount = bulkDeleted.size;
            } catch (e) {
                console.error('[مسح] Bulk delete failed:', e);
            }

            // 7. Send confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🗑️ تم المسح')
                .setDescription(`تم مسح **${deletedCount}** رسالة بواسطة ${message.author}`)
                .setColor('#9B59B6')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] }).catch(() => null);

            // Auto-delete confirmation after 5 seconds
            if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

            // 8. Log the action
            await logAction(client, message.guildId, {
                title: '🗑️ تنفيذ أمر مسح الرسائل',
                color: '#9B59B6',
                user: message.author,
                fields: [
                    { name: '📺 القناة', value: `<#${message.channelId}>`, inline: true },
                    { name: '🔢 عدد الرسائل المحذوفة', value: `\`${deletedCount}\``, inline: true },
                    { name: '🛡️ رسائل محمية (تايمر)', value: `\`${protectedIds.size}\``, inline: true },
                ]
            }).catch(() => {});
        }
    }
};
