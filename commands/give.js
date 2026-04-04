const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');
const { validateGuild } = require('../utils/guildValidator');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Bold.ttf'), 'Cairo');
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Regular.ttf'), 'Cairo');
} catch (e) {
    console.warn('Cairo fonts missing for give command.');
}

const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('تحويل كوينات لمستخدم.')
        .addUserOption(option =>
            option.setName('user').setDescription('المستخدم الأول').setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount').setDescription('الكمية').setRequired(true))
        .addUserOption(option => option.setName('user2').setDescription('المستخدم الثاني'))
        .addUserOption(option => option.setName('user3').setDescription('المستخدم الثالث'))
        .addUserOption(option => option.setName('user4').setDescription('المستخدم الرابع'))
        .addUserOption(option => option.setName('user5').setDescription('المستخدم الخامس'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        if (!isAdmin(interaction, 'give')) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply();

        const amount = interaction.options.getInteger('amount');
        const users = [
            interaction.options.getUser('user'),
            interaction.options.getUser('user2'),
            interaction.options.getUser('user3'),
            interaction.options.getUser('user4'),
            interaction.options.getUser('user5')
        ].filter(u => u !== null);

        if (amount < 1) {
            return await interaction.editReply({ content: '❌ الكمية يجب أن تكون إيجابية أو أكبر من الصفر!' });
        }

        const targetUsers = [];
        const seenIds = new Set();
        for (const u of users) {
            if (seenIds.has(u.id)) continue;
            if (u.bot) continue;
            if (u.id === interaction.user.id && !isAdmin(interaction, 'give')) continue;
            targetUsers.push(u);
            seenIds.add(u.id);
        }

        if (targetUsers.length === 0) {
            return await interaction.editReply({ content: '❌ لم يتم تحديد مستخدمين صالحين لإعطائهم كوينات.' });
        }

        const results = [];
        try {
            for (const targetUser of targetUsers) {
                const userId = targetUser.id;
                let user = await db.getUser(userId);
                const oldBalance = user ? user.coins : 0;

                if (!user) {
                    user = await db.createUser(userId, targetUser.username, amount);
                } else {
                    const newBalance = oldBalance + amount;
                    user = await db.updateUserCoins(userId, targetUser.username, newBalance, true);
                }
                results.push({ targetUser, oldBalance, newBalance: user.coins });
            }

            if (targetUsers.length === 1) {
                const targetUser = targetUsers[0];
                const { oldBalance, newBalance } = results[0];

                const canvasWidth = 800;
                const canvasHeight = 450;
                const canvas = createCanvas(canvasWidth, canvasHeight);
                const ctx = canvas.getContext('2d');

                const bgPath = path.join(__dirname, '../media/bg.png');
                try {
                    const background = await loadImage(bgPath);
                    ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                } catch (e) {
                    ctx.fillStyle = '#1a1a1a';
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                }

                const avatarSize = 150;
                const centerX = canvasWidth / 2;
                const avatarY = 110;

                ctx.save(); ctx.beginPath(); ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2, true); ctx.closePath(); ctx.clip();
                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
                try { const avatar = await loadImage(avatarUrl); ctx.drawImage(avatar, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize); } catch (e) {}
                ctx.restore();

                ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 35px Cairo'; ctx.fillText(targetUser.username, centerX, avatarY + 110);
                ctx.fillStyle = '#FFD700'; ctx.font = 'bold 22px Cairo'; ctx.fillText('GALAXY', centerX, avatarY + 145);

                const contentY = 360;
                ctx.font = 'bold 45px Cairo';
                const oldText = (oldBalance || 0).toLocaleString(); const oldWidth = ctx.measureText(oldText).width;
                const arrowText = ' ➔ '; const arrowWidth = ctx.measureText(arrowText).width;
                const newText = (newBalance || 0).toLocaleString(); const newWidth = ctx.measureText(newText).width;
                const totalWidth = oldWidth + arrowWidth + newWidth;
                let currentX = centerX - totalWidth / 2;
                ctx.fillStyle = '#ff6b6b'; ctx.textAlign = 'left'; ctx.fillText(oldText, currentX, contentY); currentX += oldWidth;
                ctx.fillStyle = '#ffffff'; ctx.fillText(arrowText, currentX, contentY); currentX += arrowWidth;
                ctx.fillStyle = '#4ee44e'; ctx.fillText(newText, currentX, contentY);
                ctx.fillStyle = '#bbbbbb'; ctx.font = '20px Cairo'; ctx.textAlign = 'center'; ctx.fillText('BALANCE UPDATED', centerX, contentY - 60);

                const buffer = await canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: 'transfer.png' });

                const giveEmbed = new EmbedBuilder()
                    .setTitle('💸 عملية تحويل ناجحة')
                    .setDescription(`تم إضافة **${amount.toLocaleString()}** كوين إلى حساب <@${targetUser.id}> بنجاح!`)
                    .setColor('#4ee44e')
                    .setImage('attachment://transfer.png')
                    .setFooter({ text: 'Galaxy Transaction System', iconURL: interaction.client.user.displayAvatarURL() })
                    .setTimestamp();

                await interaction.editReply({ embeds: [giveEmbed], files: [attachment] });
            } else {
                const userList = results.map(r => `• **${r.targetUser.username}**: \`${(r.oldBalance || 0).toLocaleString()}\` ➔ \`${(r.newBalance || 0).toLocaleString()}\``).join('\n');

                const bulkEmbed = new EmbedBuilder()
                    .setTitle('✅ عمليات إيداع متعددة')
                    .setDescription(`تم إيداع **${(amount || 0).toLocaleString()}** كوين لـ **${targetUsers.length}** أعضاء بنجاح!\n\n${userList}`)
                    .setColor('#4ee44e')
                    .setTimestamp();

                await interaction.editReply({ embeds: [bulkEmbed] });
            }

        } catch (error) {
            console.error('Error in give command:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ عملية الإيداع.' });
        }
    },
};
