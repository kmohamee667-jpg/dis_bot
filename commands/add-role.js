const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { ALLOWED_USERNAMES } = require('../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-role')
        .setDescription('إضافة رتبة إلى المتجر (للمسؤولين فقط).')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('الرتبة المراد إضافتها')
                .setRequired(true)),
    async execute(interaction) {
        const adminRoles = ['ceo', 'owner', 'dev'];
        const isWhitelisted = ALLOWED_USERNAMES.includes(interaction.user.username);
        const hasAdminRole = interaction.member && interaction.member.roles && interaction.member.roles.cache.some(role => adminRoles.includes(role.name.toLowerCase()));

        if (!isWhitelisted && !hasAdminRole) {
            return await interaction.reply({ content: '❌ غير مسموح لك باستخدام هذا الأمر! (للمسؤولين فقط)', flags: [MessageFlags.Ephemeral] });
        }

        const role = interaction.options.getRole('role');

        const modal = new ModalBuilder()
            .setCustomId(`add_role_modal_${role.id}`)
            .setTitle(`إعداد سعر رتبة: ${role.name}`);

        const priceInput = new TextInputBuilder()
            .setCustomId('price')
            .setLabel('أدخل سعر الرتبة بالكوينات')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('مثال: 5000')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(priceInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    },
};
