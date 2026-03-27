const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // --- 1. Chat Input Commands ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
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
            if (interaction.customId.startsWith('add_role_modal_')) {
                const roleId = interaction.customId.replace('add_role_modal_', '');
                const price = parseInt(interaction.fields.getTextInputValue('price'));

                if (isNaN(price) || price < 0) {
                    return await interaction.reply({ content: '❌ يجب إدخال سعر صحيح (رقم موجب).', flags: [MessageFlags.Ephemeral] });
                }

                let guild = interaction.guild;
                if (!guild && interaction.guildId) {
                    guild = await interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
                }

                // السماح بالإضافة حتى لو لم يتم العثور على السيرفر أو الرتبة (بناءً على طلب المستخدم)
                const role = guild ? guild.roles.cache.get(roleId) : null;
                const roleName = role ? role.name : 'Unknown Role';

                const shopDb = require('../utils/shopDb');
                const { updatePersistentShop } = require('../utils/shopUI');
                const success = shopDb.addRole(roleId, roleName, price);

                if (!success) {
                    return await interaction.reply({ content: '⚠️ هذه الرتبة موجودة في المتجر بالفعل!', flags: [MessageFlags.Ephemeral] });
                }

                await updatePersistentShop(interaction.client, targetGuildId).catch(() => {});

                // تسجيل الإضافة في اللوج
                const { logAction } = require('../utils/logger');
                await logAction(interaction.client, interaction.guildId, {
                    title: '➕ إضافة رتبة للمتجر',
                    color: '#3498DB',
                    user: interaction.user,
                    fields: [
                        { name: 'المسؤول', value: interaction.user.username, inline: true },
                        { name: 'الرتبة', value: roleName, inline: true },
                        { name: 'ID الرتبة', value: roleId, inline: true },
                        { name: 'السعر', value: `\`${price.toLocaleString()}\` كوين`, inline: true }
                    ]
                });
            }
        }

        // --- 3. Button Interactions ---
        else if (interaction.isButton()) {
            const shopDb = require('../utils/shopDb');
            const db = require('../utils/db');
            const { renderShop } = require('../utils/shopUI');
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const { shopMessageId } = shopDb.getMetadata();
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
                const roleData = shopDb.getRole(roleId);

                if (!roleData) {
                    return await interaction.reply({ content: '❌ عذراً، هذه الرتبة لم تعد موجودة في المتجر.', flags: [MessageFlags.Ephemeral] });
                }

                if (!interaction.member || (!interaction.member.roles && interaction.guildId)) {
                    // محاولة جلب العضو إذا كان البيانت ناقصة
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
                    .setDescription(`هل أنت متأكد من رغبتك في شراء رتبة <@&${roleId}> مقابل **${roleData.price.toLocaleString()}** كوين؟`)
                    .setColor('#FFD700');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`confirm_buy_${roleId}`)
                        .setLabel('تأكيد الشراء')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('cancel_buy')
                        .setLabel('إلغاء')
                        .setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds: [confirmEmbed], components: [row], flags: [MessageFlags.Ephemeral] });
            }

            // Cancel Purchase
            else if (interaction.customId === 'cancel_buy') {
                await interaction.update({ content: '❌ تم إلغاء عملية الشراء.', embeds: [], components: [] });
            }

            // Confirm Purchase
            else if (interaction.customId.startsWith('confirm_buy_')) {
                const roleId = interaction.customId.replace('confirm_buy_', '');
                const roleData = shopDb.getRole(roleId);
                const user = db.getUser(interaction.user.id) || db.createUser(interaction.user.id, interaction.user.username, 0);

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
                    db.updateUserCoins(interaction.user.id, interaction.user.username, newBalance);

                    await interaction.update({ content: `🎉 مبروك! لقد اشتريت رتبة **${role.name}** بنجاح وتم خصم الكوينات من رصيدك.`, embeds: [], components: [] });

                    // تسجيل عملية الشراء في اللوج المركزي
                    const { logAction } = require('../utils/logger');
                    await logAction(interaction.client, interaction.guildId, {
                        title: '🛒 عملية شراء رتبة',
                        color: '#4ee44e',
                        user: interaction.user,
                        fields: [
                            { name: '👤 المشتري', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
                            { name: '🎖️ الرتبة', value: role.name, inline: true },
                            { name: '💰 السعر', value: `\`${roleData.price.toLocaleString()}\` كوين`, inline: true }
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







