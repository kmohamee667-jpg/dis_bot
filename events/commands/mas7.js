const { EmbedBuilder } = require('discord.js');
const { isAdmin } = require('../../utils/admin-check');
const { logAction } = require('../../utils/logger');
const timerManager = require('../../utils/timerManager');

module.exports = {
    name: 'مسح',
    async execute(message, client, allowedGuildId) {
        if (allowedGuildId && message.guildId !== allowedGuildId) {
            return await message.reply({
                content: '❌ **No Permission to work here!**',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }

        if (!await isAdmin(message, 'مسح')) {
            const denyMsg = await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ You don't have permission to use this command.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);

            if (denyMsg) setTimeout(() => denyMsg.delete().catch(() => { }), 4000);
            return;
        }

        const parts = message.content.split(' ');
        let requestedCount = 9999; // Large number for full clear
        if (parts[1]) {
            const parsed = parseInt(parts[1]);
            if (!isNaN(parsed) && parsed > 0) {
                requestedCount = parsed;
            }
        }

        const protectedIds = new Set();
        for (const [, timer] of timerManager.activeTimers) {
            if (timer.messageId) protectedIds.add(String(timer.messageId));
            if (timer.messageObj?.id) protectedIds.add(String(timer.messageObj.id));
        }

        let totalDeleted = 0;
        let pages = 0;
        const maxPerPage = 100;

        do {
            const limit = Math.min(requestedCount, maxPerPage);
            let fetched;
            try {
                fetched = await message.channel.messages.fetch({ limit: limit });
            } catch (e) {
                console.error('[مسح] Fetch failed:', e);
                break;
            }

            const toDelete = fetched.filter(msg => !protectedIds.has(msg.id) && (Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000));
            
            if (toDelete.size === 0) break;

            try {
                const bulkDeleted = await message.channel.bulkDelete(toDelete, true);
                totalDeleted += bulkDeleted.size;
                pages++;
                requestedCount -= bulkDeleted.size;
                // Rate limit delay
                await new Promise(r => setTimeout(r, 1100));
            } catch (e) {
                console.error('[مسح] Bulk delete failed:', e);
                break;
            }
        } while (requestedCount > 0 && pages < 10); // Max 10 pages to prevent infinite

        const confirmEmbed = new EmbedBuilder()
            .setTitle('🗑️ تم المسح')
            .setDescription(`تم مسح **${totalDeleted}** رسالة بواسطة ${message.author}${requestedCount > 0 ? '\n(بعض الرسائل قديمة >14 يوم)' : ''}`)
            .setColor('#9B59B6')
            .setFooter({ text: 'Galaxy Moderation System' })
            .setTimestamp();

        const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] }).catch(() => null);
        if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => { }), 5000);

        await logAction(client, message.guildId, {
            title: '🗑️ تنفيذ أمر مسح الرسائل',
            color: '#4de627',
            user: message.author,
            fields: [
                { name: '📺 القناة', value: `<#${message.channelId}>`, inline: true },
                { name: '🔢 عدد المحذوفة', value: `\`${totalDeleted}\``, inline: true },
                { name: '📄 طلبت', value: `\`${requestedCount + totalDeleted}\``, inline: true },
            ]
        }).catch(() => { });
    }
};

