const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'commandes',
    async execute(message) {
        const cmdsEmbed = new EmbedBuilder()
            .setTitle('📋 قائمة أوامر Galaxy Bot')
            .setDescription('كل الأوامر المتاحة في البوت!')
            .setColor('#F1C40F')
            .addFields(
                {
                    name: '👥 أوامر المستخدمين العاديين',
                    value: '`مسح [عدد]` - مسح الرسائل\n`!start` - بدء اللعبة\n`/daily` - مكافأة يومية\n`/coins` - رصيدك\n`/shop` - المتجر\n`/give @user` - إرسال عملات\n`/challenge` - التحدي',
                    inline: false
                },
                {
                    name: '🔧 أوامر الإدارة ',
                    value: '`سم @عضو اسم` - تغيير الاسم\n`!ban @عضو` - حظر\n`!unban @عضو/ID` - فك حظر\n`ادي @عضو @رول` - إعطاء رول',
                    inline: false
                }
            )
            .setFooter({ text: 'Galaxy Moderation System | !commandes' })
            .setTimestamp();

        await message.reply({ embeds: [cmdsEmbed] }).catch(() => null);
    }
};
