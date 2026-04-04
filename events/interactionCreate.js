const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // ✅ تحقق من Server ID
        const allowedGuildId = process.env.GUILD_ID;
        if (allowedGuildId && interaction.guildId !== allowedGuildId) {
            if (interaction.isRepliable()) {
                return await interaction.reply({
                    content: '❌ **No Permission to work here!**\nهذا البوت يعمل فقط في السيرفر المخصص له',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => {});
            }
            return;
        }

        // --- 0. Autocomplete Interactions ---
        if (interaction.isAutocomplete()) {
            const focused = interaction.options.getFocused(true);
            
            if ((interaction.commandName === 'challenge' || interaction.commandName === 'start') && focused.name === 'theme') {
                const { getThemeChoices } = require('../utils/themesDb');
                const choices = await getThemeChoices();
                const filtered = choices.filter(choice =>
                    choice.name.toLowerCase().includes(focused.value.toLowerCase()) ||
                    choice.value.toLowerCase().includes(focused.value.toLowerCase())
                );
                await interaction.respond(filtered.slice(0, 25));
            }
            return;
        }

        // --- 1. Chat Input Commands ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            // ✅ Global Database Permission Check for Administrative Commands
            // Check if the command requires Administrator permission in Discord OR is specifically marked
            const { PermissionFlagsBits } = require('discord.js');
            const defaultPerms = command.data.default_member_permissions;
            const isAdminCommand = defaultPerms && (BigInt(defaultPerms) & PermissionFlagsBits.Administrator) !== 0n;

            if (isAdminCommand || command.adminOnly) {
                const { isAdmin } = require('../utils/admin-check');
                const hasPerm = await isAdmin(interaction, interaction.commandName);
                if (!hasPerm) {
                    return await interaction.reply({
                        content: '❌ **لا تملك صلاحية لاستخدام هذا الأمر.**\nهذا الأمر مخصص للإدارة وتم التحقق من صلاحيتك في قاعدة البيانات.',
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => {});
                }
            }

            try {
                await command.execute(interaction);

                const { logAction } = require('../utils/logger');
                const options = interaction.options.data.map(opt => {
                    let val = opt.value;
                    if (opt.type === 6 && opt.user) val = `${opt.user.tag} (${opt.user.id})`;
                    if (opt.type === 8 && opt.role) val = `${opt.role.name} (${opt.role.id})`;
                    if (opt.type === 7 && opt.channel) val = `${opt.channel.name} (${opt.channel.id})`;
                    return `• **${opt.name}:** \`${val}\``;
                }).join('\n') || '*لا يوجد خيارات*';

                await logAction(interaction.client, interaction.guildId, {
                    title: '🛰️ تنفيذ أمر  (/)',
                    color: '#2ECC71',
                    user: interaction.user,
                    fields: [
                        { name: 'الأمر', value: `\`/${interaction.commandName}\``, inline: true },
                        { name: 'القناة', value: `<#${interaction.channelId}>`, inline: true },
                        { name: 'التفاصيل', value: options, inline: false }
                    ]
                });
            } catch (error) {
                if (error.code === 10062 || error.code === 40060) return;
                console.error('Interaction error:', error);
                const content = 'حدث خطأ أثناء تنفيذ الأمر!';
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ content, flags: [MessageFlags.Ephemeral] }).catch(() => { });
                } else {
                    await interaction.reply({ content, flags: [MessageFlags.Ephemeral] }).catch(() => { });
                }
            }
        }

        // --- 2. Modal Submissions ---
        else if (interaction.isModalSubmit()) {
            const { logAction } = require('../utils/logger');
            const modalFields = interaction.fields.fields.map(f => `• **${f.customId}:** \`${f.value}\``).join('\n') || '*لا يوجد خيارات*';

            await logAction(interaction.client, interaction.guildId, {
                title: '📝 إرسال نموذج (Modal)',
                color: '#9B59B6',
                user: interaction.user,
                fields: [
                    { name: 'ID النموذج', value: `\`${interaction.customId}\``, inline: true },
                    { name: 'القناة', value: `<#${interaction.channelId}>`, inline: true },
                    { name: 'البيانات المرسلة', value: modalFields, inline: false }
                ]
            });
        }

        // --- 3. Button Interactions ---
        else if (interaction.isButton()) {
            const { logAction } = require('../utils/logger');
            await logAction(interaction.client, interaction.guildId, {
                title: '🔘 ضغطة زرار (Button)',
                color: '#3498DB',
                user: interaction.user,
                fields: [
                    { name: 'الزرار (CustomID)', value: `\`${interaction.customId}\``, inline: true },
                    { name: 'القناة', value: `<#${interaction.channelId}>`, inline: true }
                ]
            });

            const shopDb = require('../utils/shopDb');
            const db = require('../utils/db');
            const { renderShop } = require('../utils/shopUI');

            const metadata = await shopDb.getMetadata();
            const shopMessageId = metadata.shopMessageId;
            const isPublic = interaction.message.id === shopMessageId;

            // Pagination Handling
            if (interaction.customId.startsWith('shop_next_')) {
                const page = parseInt(interaction.customId.replace('shop_next_', ''));
                await renderShop(interaction, page + 1, isPublic);
            }
            else if (interaction.customId.startsWith('shop_prev_')) {
                const page = parseInt(interaction.customId.replace('shop_prev_', ''));
                await renderShop(interaction, page - 1, isPublic);
            }

            // Buy Role Initiation
            else if (interaction.customId.startsWith('buy_role_')) {
                const roleId = interaction.customId.replace('buy_role_', '');
                const roleData = await shopDb.getRole(roleId);

                if (!roleData) {
                    return await interaction.reply({ content: '❌ عذراً، هذه الرتبة لم تعد موجودة في المتجر.', flags: [MessageFlags.Ephemeral] });
                }

                if (!interaction.member || (!interaction.member.roles && interaction.guildId)) {
                    const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
                    if (guild) await guild.members.fetch(interaction.user.id).catch(() => null);
                }

                if (interaction.member && interaction.member.roles) {
                    const hasRole = interaction.member.roles.cache
                        ? interaction.member.roles.cache.has(roleId)
                        : (Array.isArray(interaction.member.roles) && interaction.member.roles.includes(roleId));

                    if (hasRole) {
                        return await interaction.reply({ content: '⚠️ أنت تمتلك هذه الرتبة بالفعل!', flags: [MessageFlags.Ephemeral] });
                    }
                }

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('❓ تأكيد عملية الشراء')
                    .setDescription(`هل أنت متأكد من رغبتك في شراء رتبة <@&${roleId}> مقابل **${(roleData.price || 0).toLocaleString()}** كوين؟`)
                    .setColor('#FFD700');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_buy_${roleId}`).setLabel('تأكيد الشراء').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_buy').setLabel('إلغاء').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds: [confirmEmbed], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            // Cancel Purchase
            else if (interaction.customId === 'cancel_buy') {
                await interaction.update({ content: '❌ تم إلغاء عملية الشراء.', embeds: [], components: [] });
            }

            // --- 4. Timer Stop Button ---
            else if (interaction.customId.startsWith('timer_stop_')) {
                const channelId = interaction.customId.replace('timer_stop_', '');
                const timer = timerManager.getTimer(channelId);

                try {
                    if (!timer) {
                        if (interaction.isRepliable()) {
                            return await interaction.reply({ content: '❌ هذا التايمر غير موجود أو انتهى بالفعل.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                        }
                        return;
                    }

                    const { isAdmin } = require('../utils/admin-check');
                    const isStarter = interaction.user.id === timer.starterId;
                    const hasStopPerm = await isAdmin(interaction, 'timer-stop');

                    if (!isStarter && !hasStopPerm) {
                        if (interaction.isRepliable()) {
                            return await interaction.reply({ content: '❌ You don\'t have permission to stop this timer.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                        }
                        return;
                    }

                    if (interaction.isRepliable()) {
                        await interaction.deferUpdate().catch(() => {});
                    }

                    timerManager.stopTimer(channelId, interaction.client);
                    if (timer.intervalId) clearInterval(timer.intervalId);

                    if (timer.messageId) {
                        try {
                            const msgToDelete = await interaction.channel.messages.fetch(timer.messageId).catch(() => null);
                            if (msgToDelete) await msgToDelete.delete().catch(() => {});
                        } catch (e) {}
                    }

                    const stopEmbed = new EmbedBuilder()
                        .setTitle('🛑 تم إيقاف التايمر')
                        .setDescription('تم إيقاف المؤقت يدوياً بطلب من المنظم. حظاً موفقاً في المذاكرة لاحقاً! 💪')
                        .setColor('#E74C3C')
                        .setTimestamp();

                    await interaction.channel.send({ embeds: [stopEmbed] });
                } catch (error) {
                    console.error('Interaction error caught silently:', error.message);
                }
            }

            // --- Challenge Continue Button ---
            else if (interaction.customId.startsWith('timer_continue_')) {
                const channelId = interaction.customId.replace('timer_continue_', '');
                const timer = timerManager.getTimer(channelId);

                if (!timer) {
                    return await interaction.reply({ content: '❌ هذا التايمر غير موجود أو انتهى بالفعل.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }

                if (!timer.cycleMode || timer.cycleMode !== 'manual') {
                    return await interaction.reply({ content: '⚠️ لا يمكن استكمال هذا التحدي، لأنه ليس في وضع الانتظار اليدوي.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }

                if (!timer.waitingContinue) {
                    return await interaction.reply({ content: '⚠️ لا توجد دورة في انتظار الاستكمال الآن.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }

                const { isAdmin } = require('../utils/admin-check');
                const isStarter = interaction.user.id === timer.starterId;
                const hasContinuePerm = await isAdmin(interaction, 'challenge-continue');

                if (!isStarter && !hasContinuePerm) {
                    return await interaction.reply({ content: '❌ ليس لديك صلاحية استكمال الدورة.', flags: [MessageFlags.Ephemeral] }).catch(() => {});
                }

                timer.waitingContinue = false;
                timer.status = 'running';
                // Note: Incrementing cycle and setting modes is now mostly handled in heartbeat 
                // when status becomes 'running' OR we can do it here for immediate effect.
                // For manual mode, we should set it up precisely:
                timer.currentCycle += 1;
                timer.mode = 'study';
                timer.totalTime = timer.studyTime;
                timer.timeLeft = timer.studyTime;
                timer.lastUpdate = Date.now();

                if (timer.continueMessageId) {
                    const contMsg = await interaction.channel.messages.fetch(timer.continueMessageId).catch(() => null);
                    if (contMsg) await contMsg.delete().catch(() => {});
                    timer.continueMessageId = null;
                }

                if (timer.messageId) {
                    const oldTimerMsg = await interaction.channel.messages.fetch(timer.messageId).catch(() => null);
                    if (oldTimerMsg) await oldTimerMsg.delete().catch(() => {});
                    timer.messageId = null;
                }

                await interaction.reply({ content: `✅ تم استكمال دورة التحدي. بدأنا الدورة ${timer.currentCycle} الآن.`, flags: [MessageFlags.Ephemeral] });
                if (timer.refreshCallback) {
                    await timer.refreshCallback().catch(() => {});
                }
            }

            // Confirm Purchase
            else if (interaction.customId.startsWith('confirm_buy_')) {
                const roleId = interaction.customId.replace('confirm_buy_', '');

                const [roleData, userData] = await Promise.all([
                    shopDb.getRole(roleId),
                    db.getUser(interaction.user.id)
                ]);

                let user = userData;
                if (!user) user = await db.createUser(interaction.user.id, interaction.user.username, 0);

                if (!roleData) {
                    return await interaction.update({ content: '❌ عذراً، الرتبة لم تعد متاحة.', embeds: [], components: [] });
                }

                if (user.coins < roleData.price) {
                    return await interaction.update({ content: `❌ رصيدك غير كافٍ! تحتاج إلى **${(roleData.price - user.coins).toLocaleString()}** كوين إضافية.`, embeds: [], components: [] });
                }

                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) {
                    return await interaction.update({ content: '❌ حدث خطأ: لم يتم العثور على الرتبة في السيرفر.', embeds: [], components: [] });
                }

                try {
                    let member = interaction.member;
                    if (!member || !member.roles) {
                        const guild = interaction.guild || await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
                        if (guild) member = await guild.members.fetch(interaction.user.id).catch(() => null);
                    }

                    if (!member || !member.roles) {
                        throw new Error('Member roles not available');
                    }
                    await member.roles.add(role);
                    const newBalance = user.coins - roleData.price;
                    await db.updateUserCoins(interaction.user.id, interaction.user.username, newBalance);

                    await interaction.update({ content: `🎉 مبروك! لقد اشتريت رتبة **${role.name}** بنجاح وتم خصم الكوينات من رصيدك.`, embeds: [], components: [] });

                    const { logAction } = require('../utils/logger');
                    await logAction(interaction.client, interaction.guildId, {
                        title: '🛒 عملية شراء رتبة',
                        color: '#4ee44e',
                        user: interaction.user,
                        fields: [
                            { name: '👤 المشتري', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
                            { name: '🎖️ الرتبة', value: role.name, inline: true },
                            { name: '💰 السعر', value: `\`${(roleData.price || 0).toLocaleString()}\` كوين`, inline: true }
                        ]
                    });
                } catch (err) {
                    console.error('Role assign error:', err);
                    await interaction.update({ content: '❌ فشل إعطاء الرتبة. تأكد من أن البوت لديه صلاحية `Manage Roles` وأن رتبة البوت أعلى من الرتبة المطلوبة.', embeds: [], components: [] });
                }
            }
        }
    },
};
