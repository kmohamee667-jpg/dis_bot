const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const shopDb = require('./shopDb');

async function renderShop(interaction, page, isPublic = false) {
    const roles = await shopDb.getRoles();
    const itemsPerPage = 5;
    const totalPages = Math.ceil(roles.length / itemsPerPage);
    const start = page * itemsPerPage;
    const currentRoles = roles.slice(start, start + itemsPerPage);

    const bgFile = new AttachmentBuilder(path.join(__dirname, '../media/bg.png'));

    const embed = new EmbedBuilder()
        .setTitle('━━━━━ 🏪 **𝑹𝑶𝑳𝑬 𝑴𝑨𝑹𝑲𝑬𝑻** ━━━━━')
        .setDescription('🌟 *اختر الرتبة التي ترغب في شرائها بالضغط على الزر المقابل لها.*')
        .setColor('#FFD700')
        .setImage('attachment://bg.png')
        .setThumbnail(interaction.guild ? interaction.guild.iconURL() : null)
        .setFooter({ text: `Page ${page + 1} of ${totalPages} | GALAXY SYSTEM`, iconURL: interaction.client.user.displayAvatarURL() });

    const rows = [];
    if (currentRoles.length > 0) {
        const buyButtonsRow = new ActionRowBuilder();
        for (let i = 0; i < currentRoles.length; i++) {
            const roleData = currentRoles[i];
            const role = interaction.guild ? interaction.guild.roles.cache.get(roleData.id) : null;
            const roleName = roleData.name || (role ? role.name : 'Unknown Role');

            embed.addFields({
                name: `🔹 ${roleName}`,
                value: `╼ **السعر:** \`${(roleData.price || 0).toLocaleString()}\` كوين\n╼ **المنشن:** <@&${roleData.id}>`,
                inline: true
            });

            if ((i + 1) % 2 === 0 && (i + 1) < currentRoles.length) {
                embed.addFields({ name: '\u200B', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬', inline: false });
            }

            buyButtonsRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`buy_role_${roleData.id}`)
                    .setLabel(`${roleName}`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💎')
            );
        }
        rows.push(buyButtonsRow);
    }

    if (totalPages > 1) {
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`shop_prev_${page}`)
                .setLabel('⬅️ السابق')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(`shop_next_${page}`)
                .setLabel('التالي ➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages - 1)
        );
        rows.push(navRow);
    }

    const payload = {
        embeds: [embed],
        components: rows,
        files: [bgFile],
        flags: isPublic ? [] : [MessageFlags.Ephemeral]
    };

    if (interaction.isButton()) {
        await interaction.update(payload);
    } else {
        let response;
        if (interaction.deferred || interaction.replied) {
            response = await interaction.editReply({ ...payload, withResponse: true });
        } else {
            response = await interaction.reply({ ...payload, withResponse: true });
        }

        if (isPublic) {
            const msg = response.resource ? response.resource.message : response;
            await shopDb.updateMetadata({ shopMessageId: msg.id, shopChannelId: msg.channelId });
        }
    }
}

async function updatePersistentShop(client, guildId) {
    const metadata = await shopDb.getMetadata();
    const { shopMessageId, shopChannelId } = metadata;
    if (!shopMessageId || !shopChannelId) return;

    try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(shopChannelId);
        const message = await channel.messages.fetch(shopMessageId);

        const roles = await shopDb.getRoles();
        const itemsPerPage = 5;
        const totalPages = Math.ceil(roles.length / itemsPerPage);
        const bgFile = new AttachmentBuilder(path.join(__dirname, '../media/bg.png'));

        const embed = new EmbedBuilder()
            .setTitle('━━━━━ 🏪 **𝑹𝑶𝑳𝑬 𝑴𝑨𝑹𝑲𝑬𝑻** ━━━━━')
            .setDescription('🌟 *اختر الرتبة التي ترغب في شرائها بالضغط على الزر المقابل لها.*')
            .setColor('#FFD700')
            .setImage('attachment://bg.png')
            .setThumbnail(guild ? guild.iconURL() : null)
            .setFooter({ text: `Page 1 of ${totalPages} | GALAXY SYSTEM`, iconURL: client.user.displayAvatarURL() });

        const currentRoles = roles.slice(0, itemsPerPage);
        const rows = [];

        if (currentRoles.length === 0) {
            embed.setDescription('⚠️ **المتجر فارغ حالياً!**\nانتظر حتى يقوم المسؤولون بإضافة بعض الرتب قريباً.');
        } else {
            const buyButtonsRow = new ActionRowBuilder();
            for (let i = 0; i < currentRoles.length; i++) {
                const roleData = currentRoles[i];
                const roleName = roleData.name || 'Unknown Role';
                embed.addFields({
                    name: `🔹 ${roleName}`,
                    value: `╼ **السعر:** \`${(roleData.price || 0).toLocaleString()}\` كوين\n╼ **المنشن:** <@&${roleData.id}>`,
                    inline: true
                });
                if ((i + 1) % 2 === 0 && (i + 1) < currentRoles.length) {
                    embed.addFields({ name: '\u200B', value: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬', inline: false });
                }
                buyButtonsRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`buy_role_${roleData.id}`)
                        .setLabel(`${roleName}`)
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('💎')
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

        await message.edit({ embeds: [embed], components: rows, files: [bgFile] });
    } catch (e) {
        console.error('Persistent shop update failed:', e);
    }
}

module.exports = { renderShop, updatePersistentShop };
