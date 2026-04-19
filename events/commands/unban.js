const { EmbedBuilder, MessageFlags } = require('discord.js');
const { logAction } = require('../../utils/logger');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: '!unban',
    async execute(message, client, allowedGuildId) {
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

        let targetId;
        const mention = message.mentions.users.first();
        if (mention) {
            targetId = mention.id;
        } else {
            targetId = message.content.split(' ')[1];
        }

        if (!targetId) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ Please provide a user ID or mention a user. Usage: `!unban @user` or `!unban ID`")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        const targetUser = await client.users.fetch(targetId).catch(() => null);
        try {
            const bannedUser = await message.guild.bans.fetch(targetId).catch(() => null);
            if (!bannedUser) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setDescription("❌ هذا العضو غير محظور.")
                            .setColor('#E74C3C')
                ]
            }).catch(() => null);
            }

            await message.guild.bans.remove(targetId, `Unbanned by ${message.author.tag}`);

            const unbanEmbed = new EmbedBuilder()
                .setTitle('✅ تم فك الحظر')
                .setDescription(`تم فك حظر **${bannedUser.user.tag}** بنجاح.`)
                .addFields(
                    { name: '👤 العضو', value: `${bannedUser.user.tag} (${targetId})`, inline: true },
                    { name: '🛡️ بواسطة', value: `${message.author}`, inline: true }
                )
                .setColor('#2ECC71')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            await message.channel.send({ embeds: [unbanEmbed] }).catch(() => { });

            await logAction(client, message.guildId, {
                title: '🔓 تنفيذ أمر فك الحظر',
                color: '#2ECC71',
                user: message.author,
                fields: [
                    { name: '👤 العضو', value: `${bannedUser.user.tag} (${targetId})`, inline: false },
                    { name: '📺 القناة', value: `<#${message.channelId}>`, inline: true },
                ]
            }).catch(() => { });

        } catch (error) {
            console.error('[!unban] Error:', error);
            message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ خطأ في فك الحظر. تأكد من صلاحياتي.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }
    }
};
