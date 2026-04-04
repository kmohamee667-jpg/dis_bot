const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const db = require('../utils/db');
const { validateGuild } = require('../utils/guildValidator');
const path = require('path');

try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Bold.ttf'), 'Cairo');
    GlobalFonts.registerFromPath(path.join(__dirname, '../fonts/Cairo-Regular.ttf'), 'Cairo');
} catch (e) {
    console.warn('Cairo fonts missing for coins command.');
}
const { isAdmin } = require('../utils/admin-check');

function formatCoins(coins) {
    if (coins >= 1000000) return (coins / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (coins >= 1000) return (coins / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return coins.toString();
}

function formatDate(dateString) {
    if (!dateString) return 'None';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coins')
        .setDescription('عرض رصيد العملات.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('المستخدم المراد عرض رصيده (للمسؤولين فقط)')
                .setRequired(false)),
    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        await interaction.deferReply();

        try {
            let targetUser = interaction.options.getUser('user') || interaction.user;

            if (targetUser.id !== interaction.user.id) {
                if (!await isAdmin(interaction, 'coins')) {
                    return await interaction.editReply({
                        content: '❌ You don\'t have permission to view other users\' balance.',
                        flags: [MessageFlags.Ephemeral]
                    });
                }
            }

            const userId = targetUser.id;
            const username = targetUser.username;

            let nickname = targetUser.username;
            if (interaction.guild) {
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (targetMember) nickname = targetMember.displayName;
            }

            let user = await db.getUser(userId);

            if (!user) {
                user = await db.createUser(userId, username, 0);
            } else {
                user = await db.updateUserCoins(userId, username, user.coins);
            }

            const studySeconds = await db.getStudyTime(userId);
            const studyHours = Math.floor(studySeconds / 3600);
            const studyMins = Math.floor((studySeconds % 3600) / 60);
            const studyFormatted = studyHours > 0
                ? `${studyHours}h ${studyMins}m`
                : `${studyMins}m ${studySeconds % 60}s`;

            const canvasWidth = 800;
            const canvasHeight = 450;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            const bgPath = path.join(__dirname, '../media/bg.png');
            try {
                const background = await loadImage(bgPath);
                ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            } catch (e) {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            const avatarSize = 160;
            const centerX = canvasWidth / 2;
            const avatarY = 120;

            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            try {
                const avatar = await loadImage(avatarUrl);
                ctx.drawImage(avatar, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
            } catch (e) {
                console.error('Failed to load avatar:', e);
            }
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 38px Cairo';
            ctx.fillText(nickname, centerX, avatarY + 120);

            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 24px Cairo';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
            ctx.fillText('GALAXY', centerX, avatarY + 160);
            ctx.shadowBlur = 0;

            const rowY = 350;
            const col1X = 150;
            const col2X = 400;
            const col3X = 650;

            ctx.fillStyle = '#bbbbbb';
            ctx.font = '22px Cairo';
            ctx.fillText('COINS', col1X, rowY);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 45px Cairo';
            ctx.fillText(formatCoins(user.coins), col1X, rowY + 50);

            ctx.fillStyle = '#bbbbbb';
            ctx.font = '22px Cairo';
            ctx.fillText('STUDY TIME', col2X, rowY);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Cairo';
            ctx.fillText(studyFormatted, col2X, rowY + 50);

            ctx.fillStyle = '#bbbbbb';
            ctx.font = '22px Cairo';
            ctx.fillText('LAST ADDED', col3X, rowY);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Cairo';
            ctx.fillText(formatDate(user.last_added), col3X, rowY + 50);

            const buffer = await canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'profile-card.png' });

            const coinsEmbed = new EmbedBuilder()
                .setTitle(`📊 بطاقة الكوينات - ${nickname}`)
                .setDescription(`إليك تفاصيل رصيدك في سيرفر **GALAXY**!`)
                .setColor('#FFD700')
                .setImage('attachment://profile-card.png')
                .setFooter({ text: 'Galaxy Economy System', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [coinsEmbed], files: [attachment] });

        } catch (error) {
            console.error('Error generating coins image:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء تصميم بطاقة الكوينات الخاصة بك.' });
        }
    },
};
