const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/db');
const { ALLOWED_USERNAMES } = require('../utils/config');

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
        const adminRoles = ['ceo', 'owner', 'dev'];
        const isWhitelisted = ALLOWED_USERNAMES.includes(interaction.user.username);

        let hasAdminRole = false;
        if (interaction.member && interaction.member.roles && interaction.member.roles.cache) {
            hasAdminRole = interaction.member.roles.cache.some(role => adminRoles.includes(role.name.toLowerCase()));
        }

        if (!isWhitelisted && !hasAdminRole) {
            return await interaction.reply({ content: '❌ غير مسموح لك باستخدام هذا الأمر!', flags: [MessageFlags.Ephemeral] });
        }

        const targetUser = interaction.options.getUser('user');
        const targetAll = interaction.options.getString('target');

        const { logAction } = require('../utils/logger');
        if (targetAll === 'all') {
            db.resetAllCoins();
            await logAction(interaction.client, interaction.guildId, {
                title: '🧹 تصفير جميع الكوينات',
                color: '#E67E22',
                user: interaction.user,
                description: `المسؤول **${interaction.user.username}** قام بتصفير الكوينات لجميع الأعضاء!`
            });
            return await interaction.reply({ content: '✅ تم تصفير الكوينات لجميع الأعضاء بنجاح!' });
        }

        if (targetUser) {
            db.resetUserCoins(targetUser.id);
            await logAction(interaction.client, interaction.guildId, {
                title: '🧹 تصفير كوينات عضو',
                color: '#E67E22',
                user: interaction.user,
                fields: [
                    { name: 'المسؤول', value: interaction.user.username, inline: true },
                    { name: 'العضو المستهدف', value: targetUser.username, inline: true }
                ]
            });
            return await interaction.reply({ content: `✅ تم تصفير الكوينات للمستخدم **${targetUser.username}** بنجاح!` });
        }

        return await interaction.reply({ content: '❓ يجب تحديد عضو أو اختيار `all` لتنفيذ الأمر.', flags: [MessageFlags.Ephemeral] });
    },
};
