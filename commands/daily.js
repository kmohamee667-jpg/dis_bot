const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db');



module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('احصل على جائزتك اليومية من الكوينات (كل 24 ساعة).'),
    async execute(interaction) {
        const userId = interaction.user.id;
        let user = db.getUser(userId);

        if (!user) {
            user = db.createUser(userId, interaction.user.username, 0);
        }

        const now = new Date();
        const lastClaimed = user.dailyLastClaimed ? new Date(user.dailyLastClaimed) : null;

        if (lastClaimed) {
            const diff = now - lastClaimed;
            const hoursLeft = 24 - (diff / (1000 * 60 * 60));

            if (hoursLeft > 0) {
                const h = Math.floor(hoursLeft);
                const m = Math.floor((hoursLeft - h) * 60);
                return await interaction.reply({ 
                    content: `⚠️ لقد حصلت على جائزتك بالفعل! انتظر **${h} ساعة و ${m} دقيقة** أخرى.`, 
                    flags: [require('discord.js').MessageFlags.Ephemeral] 
                });
            }
        }

        // Grant reward
        const reward = Math.floor(Math.random() * (100 - 10 + 1)) + 10;
        const newBalance = (user.coins || 0) + reward;
        db.updateUserCoins(userId, interaction.user.username, newBalance, true);
        db.setLastClaimed(userId);

        // تسجيل العملية في اللوج
        const { logAction } = require('../utils/logger');
        await logAction(interaction.client, interaction.guildId, {
            title: '🎁 استلام جائزة يومية',
            color: '#2ECC71',
            user: interaction.user,
            fields: [
                { name: 'المستخدم', value: `${interaction.user.username} (${interaction.user.id})`, inline: true },
                { name: 'المبلغ', value: `\`${reward}\` كوين`, inline: true },
                { name: 'الرصيد الجديد', value: `\`${newBalance}\` كوين`, inline: true }
            ]
        });

        await interaction.reply({ 
            content: `🎁 مبروك! لقد حصلت على **${reward}** كوين جائزة يومية.\nرصيدك الآن: **${newBalance}** كوين.`
        });
    },
};
