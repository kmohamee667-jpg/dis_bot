const { EmbedBuilder, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/logger');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: 'ban',
    async execute(message, client, allowedGuildId) {
        if (allowedGuildId && message.guildId !== allowedGuildId) {
            return await message.reply({
                content: '❌ **No Permission to work here!**',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }

        const target = message.mentions.members.first();
        if (!target) {
            return message.reply('❌ Please mention the user you want to ban using `!ban @user`.').catch(() => { });
        }

        if (message.author.username !== ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ You don't have permission to use this command.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (target.user.username === ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ لا يمكن حظر الإدمن.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (target.username === message.author.username) {
            return message.reply('❌ You cannot ban yourself!').catch(() => { });
        }

        if (!target.bannable) {
            return message.reply('❌ I cannot ban this user. They might have a higher role than me or I lack the "Ban Members" permission.').catch(() => { });
        }

        try {
            await target.ban({ reason: `Banned by ${message.author.tag} using !ban command` });

            const banEmbed = new EmbedBuilder()
                .setTitle('🔨 تم التبيند')
                .setDescription(`تم طرد **${target.user.tag}** بنجاح من السيرفر.`)
                .addFields(
                    { name: '👤 العضو', value: `${target.user}`, inline: true },
                    { name: '🛡️ بواسطة', value: `${message.author}`, inline: true }
                )
                .setColor('#E74C3C')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            await message.channel.send({ embeds: [banEmbed] }).catch(() => { });

            await logAction(client, message.guildId, {
                title: '🔨 تنفيذ أمر الباند',
                color: '#E74C3C',
                user: message.author,
                fields: [
                    { name: '👤 العضو المطرود', value: `${target.user.tag} (${target.id})`, inline: false },
                    { name: '📺 القناة', value: `<#${message.channelId}>`, inline: true },
                ]
            }).catch(() => { });

        } catch (error) {
            console.error('[!ban] Error banning user:', error);
            message.reply('❌ An error occurred while trying to ban the user.').catch(() => { });
        }
    }
};
