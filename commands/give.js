const { SlashCommandBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/db');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const { ALLOWED_USERNAMES } = require('../utils/config');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('give')
		.setDescription('تحويل كوينات لمستخدم.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('المستخدم الأول')
				.setRequired(true))
		.addIntegerOption(option =>
			option.setName('amount')
				.setDescription('الكمية')
				.setRequired(true))
		.addUserOption(option => option.setName('user2').setDescription('المستخدم الثاني'))
		.addUserOption(option => option.setName('user3').setDescription('المستخدم الثالث'))
		.addUserOption(option => option.setName('user4').setDescription('المستخدم الرابع'))
		.addUserOption(option => option.setName('user5').setDescription('المستخدم الخامس')),
    async execute(interaction) {
        const { logAction } = require('../utils/logger');
        const adminRoles = ['ceo', 'owner', 'dev'];
        const isWhitelisted = ALLOWED_USERNAMES.includes(interaction.user.username);

        let hasAdminRole = false;
        if (interaction.member && interaction.member.roles && interaction.member.roles.cache) {
            hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.name.toLowerCase()));
        }

        if (!isWhitelisted && !hasAdminRole) {
            return await interaction.reply({ 
                content: '❌ غير مسموح لك باستخدام هذا الأمر! (للمسؤولين فقط)', 
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

		// تصفية المستخدمين (إزالة المتكرر والبوتات وإعطاء النفس إذا لم يكن مسؤولاً)
		const targetUsers = [];
		const seenIds = new Set();
		for (const u of users) {
			if (seenIds.has(u.id)) continue;
			if (u.bot) continue;
			if (u.id === interaction.user.id && !ALLOWED_USERNAMES.includes(interaction.user.username)) continue;
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
				let user = db.getUser(userId);
				const oldBalance = user ? user.coins : 0;

				if (!user) {
					user = db.createUser(userId, targetUser.username, amount);
				} else {
					const newBalance = oldBalance + amount;
					user = db.updateUserCoins(userId, targetUser.username, newBalance, true);
				}
				results.push({ targetUser, oldBalance, newBalance: user.coins });

				// تسجيل العملية في اللوج
				await logAction(interaction.client, interaction.guildId, {
					title: '💰 إيداع كوينات إداري',
					color: '#F1C40F',
					user: interaction.user,
					fields: [
						{ name: 'المسؤول', value: interaction.user.username, inline: true },
						{ name: 'المستلم', value: targetUser.username, inline: true },
						{ name: 'المبلغ', value: `\`${amount.toLocaleString()}\` كوين`, inline: true },
						{ name: 'الرصيد القديم', value: `\`${oldBalance.toLocaleString()}\``, inline: true },
						{ name: 'الرصيد الجديد', value: `\`${user.coins.toLocaleString()}\``, inline: true }
					]
				});
			}

			// إذا كان مستخدم واحد، نظهر الصورة التقليدية
			if (targetUsers.length === 1) {
				const targetUser = targetUsers[0];
				const { oldBalance, newBalance } = results[0];

				// Generate Transaction Image
				const canvasWidth = 800;
				const canvasHeight = 450;
				const canvas = createCanvas(canvasWidth, canvasHeight);
				const ctx = canvas.getContext('2d');

				// 1. Background
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

				// 2. Avatar
				const avatarSize = 150;
				const centerX = canvasWidth / 2;
				const avatarY = 110;
				
				ctx.save(); ctx.beginPath(); ctx.arc(centerX, avatarY, avatarSize / 2, 0, Math.PI * 2, true); ctx.closePath(); ctx.clip();
				const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
				try { const avatar = await loadImage(avatarUrl); ctx.drawImage(avatar, centerX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize); } catch (e) {}
				ctx.restore();

				// 3. Names
				ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 35px sans-serif'; ctx.fillText(targetUser.username, centerX, avatarY + 110);
				ctx.fillStyle = '#FFD700'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('GALAXY', centerX, avatarY + 145);

				// 4. Balance Transition
				const contentY = 360;
				ctx.font = 'bold 45px sans-serif';
				const oldText = oldBalance.toLocaleString(); const oldWidth = ctx.measureText(oldText).width;
				const arrowText = ' ➔ '; const arrowWidth = ctx.measureText(arrowText).width;
				const newText = newBalance.toLocaleString(); const newWidth = ctx.measureText(newText).width;
				const totalWidth = oldWidth + arrowWidth + newWidth;
				let currentX = centerX - totalWidth / 2;
				ctx.fillStyle = '#ff6b6b'; ctx.textAlign = 'left'; ctx.fillText(oldText, currentX, contentY); currentX += oldWidth;
				ctx.fillStyle = '#ffffff'; ctx.fillText(arrowText, currentX, contentY); currentX += arrowWidth;
				ctx.fillStyle = '#4ee44e'; ctx.fillText(newText, currentX, contentY);
				ctx.fillStyle = '#bbbbbb'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BALANCE UPDATED', centerX, contentY - 60);

				const buffer = await canvas.toBuffer('image/png');
				const attachment = new AttachmentBuilder(buffer, { name: 'transfer.png' });
				await interaction.editReply({ files: [attachment] });
			} else {
				// عرض قائمة ملخصة لعدة مستخدمين
				const userList = results.map(r => `• **${r.targetUser.username}**: \`${r.oldBalance.toLocaleString()}\` ➔ \`${r.newBalance.toLocaleString()}\``).join('\n');
				await interaction.editReply({ content: `✅ تم إيداع **${amount.toLocaleString()}** كوين لـ **${targetUsers.length}** أعضاء بنجاح!\n\n${userList}` });
			}

		} catch (error) {
			console.error('Error in give command:', error);
			await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ عملية الإيداع.' });
		}
	},
};

