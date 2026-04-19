const { EmbedBuilder, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/logger');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: 'ادي ',
    async execute(message, client, allowedGuildId) {
        console.log('ادي command triggered', message.content);
        if (message.author.username !== ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ You don't have permission to use this command.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (allowedGuildId && message.guildId !== allowedGuildId) {
            return await message.reply({
                content: '❌ **No Permission to work here!**',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }

        const targetMember = message.mentions.members?.first();
        const targetRole = message.mentions.roles?.first();

        if (!targetMember || !targetRole) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ استخدم: `ادي @عضو @رول`")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        // Protect admin - allow self for admin only
        if (targetMember.user.username === ADMIN_USERNAME && message.author.username !== ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ لا يمكن إعطاء رول للإدمن.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (targetMember.roles.cache.has(targetRole.id)) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ العضو لديه هذا الرول بالفعل.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        try {
            await targetMember.roles.add(targetRole, `Added by ${message.author.tag}`);

            const giveRoleEmbed = new EmbedBuilder()
                .setTitle('✅ تم إعطاء الرول')
                .setDescription(`تم إعطاء رول **${targetRole.name}** لـ **${targetMember.user.tag}**.`)
                .addFields(
                    { name: '👤 العضو', value: `${targetMember.user}`, inline: true },
                    { name: '📝 الرول', value: `${targetRole}`, inline: true },
                    { name: '🛡️ بواسطة', value: `${message.author}`, inline: true }
                )
                .setColor('#2ECC71')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            await message.channel.send({ embeds: [giveRoleEmbed] }).catch(() => { });

            await logAction(client, message.guildId, {
                title: '➕ تنفيذ أمر إعطاء رول',
                color: '#2ECC71',
                user: message.author,
                fields: [
                    { name: '👤 العضو', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
                    { name: '📝 الرول', value: `${targetRole.name} (${targetRole.id})`, inline: true },
                    { name: '📺 القناة', value: `<#${message.channelId}>`, inline: true },
                ]
            }).catch(() => { });

        } catch (error) {
            console.error('[ادي] Error:', error);
            message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ خطأ في إعطاء الرول. تأكد من الصلاحيات.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }
    }
};
