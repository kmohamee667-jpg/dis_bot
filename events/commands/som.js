const { EmbedBuilder } = require('discord.js');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: 'سم',
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

        const mentionedUser = message.mentions.members.first();
        if (!mentionedUser) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ Please mention a user to change their nickname.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        if (mentionedUser.user.username === ADMIN_USERNAME) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ لا يمكن تغيير اسم الإدمن.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        const parts = message.content.split(' ');
        const newNickname = parts.slice(2).join(' ');
        if (!newNickname) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ You need to provide a new nickname.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }

        try {
            await mentionedUser.setNickname(newNickname);
            
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ تم تغيير الاسم المستعار')
                .setDescription(`تم تغيير الاسم المستعار لـ **${mentionedUser.user.tag}** إلى **${newNickname}** بواسطة ${message.author.tag}`)
                .setColor('#2ECC71')
                .setFooter({ text: 'Galaxy Moderation System' })
                .setTimestamp();

            await message.channel.send({ embeds: [successEmbed] }).catch(() => { });
        } catch (error) {
            console.error('[سم] Error changing nickname:', error);
            message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setDescription("❌ An error occurred while trying to change the nickname.")
                        .setColor('#E74C3C')
                ]
            }).catch(() => null);
        }
    }
};
