const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-price')
        .setDescription('تعديل سعر رتبة موجودة في المتجر (للمسؤولين فقط).')
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('الرتبة المراد تعديل سعرها')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('price')
                .setDescription('السعر الجديد بالكوينات')
                .setRequired(true)),
    async execute(interaction) {
        if (!isAdmin(interaction, 'edit-price')) {
            return await interaction.reply({ 
                content: '❌ You don\'t have permission to use this command.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const role = interaction.options.getRole('role');
        const price = interaction.options.getInteger('price');

        if (price < 0) {
            return await interaction.reply({ 
                content: '❌ يجب إدخال سعر صحيح (رقم موجب).', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        const success = shopDb.updateRolePrice(role.id, price);

        if (!success) {
            return await interaction.reply({ 
                content: '⚠️ هذه الرتبة غير موجودة في المتجر! أضفها أولاً باستخدام `/add-role`.', 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        await interaction.reply({ 
            content: `✅ تم تحديث سعر الرتبة **${role.name}** إلى **${price.toLocaleString()}** كوين بنجاح.`,
            flags: [MessageFlags.Ephemeral]
        });

        // التحديث التلقائي للشوب الثابت
        const { updatePersistentShop } = require('../utils/shopUI');
        await updatePersistentShop(interaction.client, interaction.guildId).catch(() => {});
    },
};
