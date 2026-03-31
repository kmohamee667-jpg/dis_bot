const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { validateGuild } = require('../utils/guildValidator');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-role')
        .setDescription('حذف رتبة من المتجر (للمسؤولين فقط).')
        .addRoleOption(option =>
            option.setName('role').setDescription('الرتبة المراد حذفها').setRequired(true)),
    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        if (!isAdmin(interaction, 'delete-role')) {
            return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', flags: [MessageFlags.Ephemeral] });
        }

        const role = interaction.options.getRole('role');

        const existingRole = await shopDb.getRole(role.id);
        if (!existingRole) {
            return await interaction.reply({ content: '⚠️ هذه الرتبة غير موجودة في المتجر أصلاً.', flags: [MessageFlags.Ephemeral] });
        }

        await shopDb.deleteRole(role.id);

        await interaction.reply({ content: `✅ تم حذف الرتبة **${role.name}** من المتجر بنجاح.`, flags: [MessageFlags.Ephemeral] });

        const { updatePersistentShop } = require('../utils/shopUI');
        await updatePersistentShop(interaction.client, interaction.guildId);
    },
};
