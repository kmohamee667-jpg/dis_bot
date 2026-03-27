const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { renderShop } = require('../utils/shopUI');
const { ALLOWED_USERNAMES } = require('../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('عرض المتجر وشراء الرتب.'),
    async execute(interaction) {
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

        const roles = shopDb.getRoles();
        if (roles.length === 0) {
            return await interaction.reply({ content: '⚠️ المتجر فارغ حالياً! انتظر حتى يضيف المسؤولون بعض الرتب.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply();
        await renderShop(interaction, 0, true);
    },
};
