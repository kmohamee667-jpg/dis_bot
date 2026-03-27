const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { ALLOWED_USERNAMES } = require('../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-role')
        .setDescription('حذف رتبة من المتجر (للمسؤولين فقط).')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('الرتبة المراد حذفها')
                .setRequired(true)),
    async execute(interaction) {
        const adminRoles = ['ceo', 'owner', 'dev'];
        const isWhitelisted = ALLOWED_USERNAMES.includes(interaction.user.username);
        const hasAdminRole = interaction.member && interaction.member.roles && interaction.member.roles.cache.some(role => adminRoles.includes(role.name.toLowerCase()));

        if (!isWhitelisted && !hasAdminRole) {
            return await interaction.reply({ content: '❌ غير مسموح لك باستخدام هذا الأمر! (للمسؤولين فقط)', flags: [MessageFlags.Ephemeral] });
        }

        const role = interaction.options.getRole('role');
        
        const existingRole = shopDb.getRole(role.id);
        if (!existingRole) {
            return await interaction.reply({ content: '⚠️ هذه الرتبة غير موجودة في المتجر أصلاً.', flags: [MessageFlags.Ephemeral] });
        }

        shopDb.deleteRole(role.id);
        
        await interaction.reply({ content: `✅ تم حذف الرتبة **${role.name}** من المتجر بنجاح.`, flags: [MessageFlags.Ephemeral] });

        // تسجيل الحذف في اللوج
        const { logAction } = require('../utils/logger');
        await logAction(interaction.client, interaction.guildId, {
            title: '➖ حذف رتبة من المتجر',
            color: '#E74C3C',
            user: interaction.user,
            fields: [
                { name: 'المسؤول', value: interaction.user.username, inline: true },
                { name: 'الرتبة', value: role.name, inline: true },
                { name: 'ID الرتبة', value: role.id, inline: true }
            ]
        });

        // التحديث التلقائي للشوب الثابت
        const { updatePersistentShop } = require('../utils/shopUI');
        await updatePersistentShop(interaction.client, interaction.guildId);
    },
};
