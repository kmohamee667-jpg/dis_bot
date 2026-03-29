const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top-time')
        .setDescription('عرض أعلى 5 في study time من التحدي (مدراء فقط)')
        .setDMPermission(false),

    async execute(interaction) {
        if (!isAdmin(interaction, 'top-time')) {
            return await interaction.reply({ content: '❌ ليس لديك صلاحية استخدام هذا الأمر.', flags: [MessageFlags.Ephemeral] });
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            return await interaction.reply({ content: '❌ يجب تشغيل الأمر داخل سيرفر.', flags: [MessageFlags.Ephemeral] });
        }

        const top = timerManager.getGuildTopStudy(guildId, 5);
        if (!top || top.length === 0) {
            return await interaction.reply({ content: 'ℹ️ لا توجد بيانات study time حتى الآن.', flags: [MessageFlags.Ephemeral] });
        }

        const description = top.map((item, idx) => {
            const mins = Math.floor(item.seconds / 60);
            const secs = item.seconds % 60;
            return `**${idx + 1}.** <@${item.userId}> — ${mins}m ${secs}s`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('🏆 أعلى 5 Study Time في السيرفر')
            .setDescription(description)
            .setColor('#f1c40f')
            .setFooter({ text: 'Top Time | تحدي المذاكرة' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};