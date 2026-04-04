const { EmbedBuilder, MessageFlags } = require('discord.js');
const { isAdmin } = require('../utils/admin-check');
const { getPermissionsSync } = require('../utils/configDb');
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
                    content: '❌ **No Permission to work here!',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
            }

            // 1. Permission check
            if (!await isAdmin(message, 'مسح')) {
                const denyMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ You don't have permission to use this command.")
                            .setColor('#E74C3C')
                    ]
                }).catch(() => null);

                // Auto-delete the denial after 4 seconds — original message stays
                if (denyMsg) setTimeout(() => denyMsg.delete().catch(() => {}), 4000);
                return; // ✅ توقف تماماً - لا تمسح أي شيء
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

            // 5. Fetch messages
            let fetched;
            try {
                fetched = await message.channel.messages.fetch({ limit: count });
            } catch (e) {
                console.error('[مسح] Failed to fetch messages:', e);
                return;
            }

            // 6. Filter out protected timer messages
            const toDelete = fetched.filter(msg => !protectedIds.has(msg.id));

            // 7. Bulk delete (discord only allows messages < 14 days old)
            let deletedCount = 0;
            try {
                const bulkDeleted = await message.channel.bulkDelete(toDelete, true); // true = filter old messages
                deletedCount = bulkDeleted.size;
            } catch (e) {
                console.error('[مسح] Bulk delete failed:', e);
            }

            // 8. Send confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setTitle('🗑️ تم المسح')
                .setDescription(`تم مسح **${deletedCount}** رسالة بواسطة ${message.author}`)
                .setColor('#9B59B6')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            const confirmMsg = await message.channel.send({ embeds: [confirmEmbed] }).catch(() => null);

            // Auto-delete confirmation after 5 seconds
            if (confirmMsg) setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

            // 9. Log the action
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

            if (message.deletable) await message.delete().catch(() => {});
        }

        // ─── Keyword: قفل ──────────────────────────────────────────────
        if (content === 'قفل') {
            if (!await isAdmin(message, 'قفل')) {
                const denyMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ ليس لديك صلاحية لاستخدام هذا الأمر.")
                            .setColor('#E74C3C')
                    ]
                }).catch(() => null);
                if (denyMsg) setTimeout(() => denyMsg.delete().catch(() => {}), 4000);
                return;
            }

            try {
                // 1. Get all authorized roles/users for 'قفل' to allow bypass
                const perms = getPermissionsSync('قفل');
                const overwrites = [];

                // Always deny @everyone
                overwrites.push({
                    id: message.guild.roles.everyone.id,
                    deny: ['SendMessages']
                });

                if (perms) {
                    // Roles bypass
                    for (const roleVal of perms.roles) {
                        const role = message.guild.roles.cache.find(r => r.name === roleVal || r.id === roleVal);
                        if (role) {
                            overwrites.push({
                                id: role.id,
                                allow: ['SendMessages']
                            });
                        }
                    }

                    // Users bypass
                    for (const userVal of perms.users) {
                        const member = message.guild.members.cache.find(m => m.id === userVal || m.user.username === userVal);
                        if (member) {
                            overwrites.push({
                                id: member.id,
                                allow: ['SendMessages']
                            });
                        }
                    }
                }

                // Apply overwrites
                for (const ov of overwrites) {
                    await message.channel.permissionOverwrites.edit(ov.id, {
                        SendMessages: ov.allow?.includes('SendMessages') ? true : false
                    }).catch(err => console.error(`[قفل] Failed to set overwrite for ${ov.id}:`, err));
                }

                const lockEmbed = new EmbedBuilder()
                    .setTitle('🔒 قفل القناة')
                    .setDescription(`تم قفل القناة بواسطة: ${message.author}\n**يمنع إرسال الرسائل للأعضاء، ويسمح للإدارة فقط.**`)
                    .setColor('#E74C3C')
                    .setFooter({ text: 'Galaxy Moderation System' })
                    .setTimestamp();

                await message.channel.send({ embeds: [lockEmbed] });

                await logAction(client, message.guildId, {
                    title: '🔒 قفل القناة',
                    color: '#E74C3C',
                    user: message.author,
                    fields: [{ name: '📺 القناة', value: `<#${message.channelId}>`, inline: true }]
                });

                if (message.deletable) await message.delete().catch(() => {});
            } catch (e) {
                console.error('[قفل] Error:', e);
                await message.reply('❌ فشل قفل القناة. تأكد من صلاحيات البوت.').catch(() => {});
            }
        }

        // ─── Keyword: فتح ──────────────────────────────────────────────
        if (content === 'فتح') {
            if (!await isAdmin(message, 'قفل')) {
                const denyMsg = await message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ ليس لديك صلاحية لاستخدام هذا الأمر.")
                            .setColor('#E74C3C')
                    ]
                }).catch(() => null);
                if (denyMsg) setTimeout(() => denyMsg.delete().catch(() => {}), 4000);
                return;
            }

            try {
                // 1. Reset @everyone
                await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
                    SendMessages: true
                });

                // 2. Reset Admin Bypass
                const perms = getPermissionsSync('قفل');
                if (perms) {
                    for (const roleVal of perms.roles) {
                        const role = message.guild.roles.cache.find(r => r.name === roleVal || r.id === roleVal);
                        if (role) {
                            await message.channel.permissionOverwrites.edit(role.id, {
                                SendMessages: null
                            }).catch(() => {});
                        }
                    }
                    for (const userVal of perms.users) {
                        const member = message.guild.members.cache.find(m => m.id === userVal || m.user.username === userVal);
                        if (member) {
                            await message.channel.permissionOverwrites.edit(member.id, {
                                SendMessages: null
                            }).catch(() => {});
                        }
                    }
                }

                const unlockEmbed = new EmbedBuilder()
                    .setTitle('🔓 فتح القناة')
                    .setDescription(`تم فتح القناة بواسطة: ${message.author}\n**يمكن للجميع إرسال الرسائل الآن.**`)
                    .setColor('#2ECC71')
                    .setFooter({ text: 'Galaxy Moderation System' })
                    .setTimestamp();

                await message.channel.send({ embeds: [unlockEmbed] });

                await logAction(client, message.guildId, {
                    title: '🔓 فتح القناة',
                    color: '#2ECC71',
                    user: message.author,
                    fields: [{ name: '📺 القناة', value: `<#${message.channelId}>`, inline: true }]
                });

                if (message.deletable) await message.delete().catch(() => {});
            } catch (e) {
                console.error('[فتح] Error:', e);
                await message.reply('❌ فشل فتح القناة. تأكد من صلاحيات البوت.').catch(() => {});
            }
        }
    }
};
