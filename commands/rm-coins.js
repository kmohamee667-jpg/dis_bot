const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/db');
const { validateGuild } = require('../utils/guildValidator');
const { isAdmin } = require('../utils/admin-check');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rm-coins')
        .setDescription('تصفير الكوينات لمستخدم أو للجميع.')
        .addUserOption(option =>
            option.setName('user').setDescription('المستخدم المراد تصفير كويناته'))
        .addStringOption(option =>
            option.setName('target').setDescription('اكتب all لتصفير الجميع').addChoices({ name: 'all', value: 'all' }))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        if (!isAdmin(interaction, 'rm-coins')) {
            return await interaction.reply({ content: '❌ You don\'t have permission to use this command.', flags: [MessageFlags.Ephemeral] });
        }

        const targetUser = interaction.options.getUser('user');
        const targetAll = interaction.options.getString('target');

        if (targetAll === 'all') {
            await db.resetAllCoins();
            return await interaction.reply({ content: '✅ تم تصفير الكوينات لجميع الأعضاء بنجاح!' });
        }

        if (targetUser) {
            await db.resetUserCoins(targetUser.id);
            return await interaction.reply({ content: `✅ تم تصفير الكوينات للمستخدم **${targetUser.username}** بنجاح!` });
        }

        return await interaction.reply({ content: '❓ يجب تحديد عضو أو اختيار `all` لتنفيذ الأمر.', flags: [MessageFlags.Ephemeral] });
    },
};
