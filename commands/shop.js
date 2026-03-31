const { SlashCommandBuilder, MessageFlags, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const shopDb = require('../utils/shopDb');
const { validateGuild } = require('../utils/guildValidator');
const { renderShop } = require('../utils/shopUI');
const { isAdmin } = require('../utils/admin-check');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('عرض المتجر وشراء الرتب.')
        .addSubcommand(subcommand =>
            subcommand.setName('view').setDescription('عرض المتجر الحالي'))
        .addSubcommand(subcommand =>
            subcommand.setName('setup').setDescription('إعداد متجر دائم في هذه القناة (للمسؤولين فقط)')),
    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            if (!isAdmin(interaction, 'shop-setup')) {
                return await interaction.reply({
                    content: '❌ You don\'t have permission to use this command.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            try {
                const roles = await shopDb.getRoles();
                const itemsPerPage = 5;
                const totalPages = Math.ceil(roles.length / itemsPerPage);
                const bgFile = new AttachmentBuilder(path.join(__dirname, '../media/bg.png'));

                const embed = new EmbedBuilder()
                    .setTitle('━━━━━ 🏪 **𝑹𝑶𝑳𝑬 𝑴𝑨𝑹𝑲𝑬𝑻** ━━━━━')
                    .setDescription(roles.length === 0
                        ? '⚠️ **المتجر فارغ حالياً!**\nانتظر حتى يقوم المسؤولون بإضافة بعض الرتب قريباً.'
                        : '🌟 *اختر الرتبة التي ترغب في شرائها بالضغط على الزر المقابل لها.*')
                    .setColor('#FFD700')
                    .setImage('attachment://bg.png')
                    .setThumbnail(interaction.guild ? interaction.guild.iconURL() : null)
                    .setFooter({ text: `Page 1 of ${totalPages || 1} | GALAXY SYSTEM`, iconURL: interaction.client.user.displayAvatarURL() });

                const rows = [];
                const currentRoles = roles.slice(0, itemsPerPage);
                if (currentRoles.length > 0) {
                    const buyButtonsRow = new ActionRowBuilder();
                    for (let i = 0; i < currentRoles.length; i++) {
                        const roleData = currentRoles[i];
                        embed.addFields({
                            name: `🔹 ${roleData.name}`,
                            value: `╼ **السعر:** \`${(roleData.price || 0).toLocaleString()}\` كوين\n╼ **المنشن:** <@&${roleData.id}>`,
                            inline: true
                        });
                        buyButtonsRow.addComponents(
                            new ButtonBuilder().setCustomId(`buy_role_${roleData.id}`).setLabel(`${roleData.name}`).setStyle(ButtonStyle.Success).setEmoji('💎')
                        );
                    }
                    rows.push(buyButtonsRow);
                    if (totalPages > 1) {
                        const navRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('shop_prev_0').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(true),
                            new ButtonBuilder().setCustomId('shop_next_0').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(false)
                        );
                        rows.push(navRow);
                    }
                }

                const sentMessage = await interaction.channel.send({ embeds: [embed], components: rows, files: [bgFile] });

                await shopDb.updateMetadata({
                    shopMessageId: sentMessage.id,
                    shopChannelId: sentMessage.channelId
                });

                await interaction.editReply({ content: '✅ تم إعداد المتجر الدائم بنجاح في هذه القناة! سيتم تحديثه تلقائياً عند أي تغيير.' });
            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ أثناء إعداد المتجر.' });
            }
            return;
        }

        const roles = await shopDb.getRoles();
        if (roles.length === 0) {
            return await interaction.reply({ content: '⚠️ المتجر فارغ حالياً! انتظر حتى يضيف المسؤولون بعض الرتب.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        await renderShop(interaction, 0, false);
    },
};
