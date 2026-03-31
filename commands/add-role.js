const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-role')
        .setDescription('إضافة رتبة إلى المتجر (للمسؤولين فقط).')
        .addRoleOption(option =>
            option.setName('role').setDescription('الرتبة المراد إضافتها').setRequired(true))
        .addIntegerOption(option =>
            option.setName('price').setDescription('سعر الرتبة بالكوينات').setRequired(true)),
    async execute(interaction) {
        if (!isAdmin(interaction, 'add-role')) {
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

        const success = await shopDb.addRole(role.id, role.name, price);

        if (!success) {
            return await interaction.reply({
                content: '⚠️ هذه الرتبة موجودة في المتجر بالفعل!',
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.reply({
            content: `✅ الرول تم اضافه <@&${role.id}> للمتجر بنجاح بسعر **${(price || 0).toLocaleString()}** كوين.`,
            flags: [MessageFlags.Ephemeral]
        });

        const { updatePersistentShop } = require('../utils/shopUI');
        await updatePersistentShop(interaction.client, interaction.guildId).catch(() => {});
    },
};
