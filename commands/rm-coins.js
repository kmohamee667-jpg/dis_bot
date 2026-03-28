const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/db');
const { ALLOWED_USERNAMES } = require('../utils/config');

const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rm-coins')
        .setDescription('تصفير الكوينات لمستخدم أو للجميع.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('المستخدم المراد تصفير كويناته'))
        .addStringOption(option => 
            option.setName('target')
                .setDescription('اكتب all لتصفير الجميع')
                .addChoices({ name: 'all', value: 'all' })),
    async execute(interaction) {
        if (!isAdmin(interaction)) {
            return await interaction.reply({ content: '❌ غير مسموح لك باستخدام هذا الأمر!', flags: [MessageFlags.Ephemeral] });
        }

        const targetUser = interaction.options.getUser('user');
        const targetAll = interaction.options.getString('target');

        const { logAction } = require('../utils/logger');
        if (targetAll === 'all') {
            db.resetAllCoins();
            return await interaction.reply({ content: '✅ تم تصفير الكوينات لجميع الأعضاء بنجاح!' });
        }

        if (targetUser) {
            db.resetUserCoins(targetUser.id);
            return await interaction.reply({ content: `✅ تم تصفير الكوينات للمستخدم **${targetUser.username}** بنجاح!` });
        }

        return await interaction.reply({ content: '❓ يجب تحديد عضو أو اختيار `all` لتنفيذ الأمر.', flags: [MessageFlags.Ephemeral] });
    },
};
