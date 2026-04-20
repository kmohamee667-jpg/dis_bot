const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: '!rm-roles',
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

        // Button confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ تأكيد حذف الرولات')
            .setDescription('**هل انت متأكد تماماً من حذف جميع الرولات أقل من رتبة البوت؟**\\n\\nهذا العمل لا يمكن التراجع عنه!')
            .setColor('#FF0000')
            .setFooter({ text: `فقط ${ADMIN_USERNAME} يمكنه الضغط` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_rm_roles')
                    .setLabel('تأكيد حذف الرولات')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_rm_roles')
                    .setLabel('إلغاء')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await message.reply({
            embeds: [confirmEmbed],
            components: [row],
            flags: [MessageFlags.Ephemeral]
        }).catch(() => null);

        if (!confirmMsg) return;

        const filter = i => i.user.username === ADMIN_USERNAME;
        const collector = confirmMsg.createMessageComponentCollector({
            filter,
            time: 30000
        });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            
            if (interaction.customId === 'cancel_rm_roles') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('❌ **تم إلغاء عملية حذف الرولات**')
                    .setColor('#00FF00');
                await confirmMsg.edit({
                    embeds: [cancelEmbed],
                    components: []
                }).catch(() => {});
                return collector.stop();
            }

            // Get bot's highest role position
            const botMember = interaction.guild.members.me;
            const botPosition = botMember.roles.highest.position;
            console.log(`🗑️ RM-ROLES START - Bot highest position: ${botPosition} | Guild ID: ${interaction.guildId}`);

            // Filter roles: below bot position, deletable, not @everyone
            const roles = interaction.guild.roles.cache.filter(role => 
                role.position < botPosition && 
                role.deletable && 
                role.id !== interaction.guild.id
            );

            let deletedCount = 0;
            let errorCount = 0;

            console.log(`🎯 Found ${roles.size} roles to potentially delete.`);

            // Delete roles sequentially with rate limiting
            for (const [id, role] of roles) {
                try {
                    await role.delete('RM-ROLES command');
                    console.log(`🗑️ Deleted role: ${role.name} (ID: ${role.id}, Pos: ${role.position})`);
                    deletedCount++;
                } catch (e) {
                    console.error(`❌ Failed to delete role ${role.name} (Pos: ${role.position}):`, e.message);
                    errorCount++;
                }
                // Rate limit: 800ms delay
                await new Promise(r => setTimeout(r, 800));
            }

            // Success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('🗑️ حذف الرولات اكتمل')
                .setDescription(`**تم حذف الرولات بنجاح!**\n\n✅ محذوفة: **${deletedCount}**\n❌ أخطاء: **${errorCount}**\n\n> تم حذف الرولات فقط أقل من رتبة البوت (Position ${botPosition})`)
                .setColor('#00FF00')
                .addFields(
                    { name: 'معلومات البوت', value: `Highest Role Pos: ${botPosition}`, inline: true },
                    { name: 'الوقت', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: true }
                )
                .setFooter({ text: `Requested by ${ADMIN_USERNAME}` });

            await confirmMsg.edit({
                embeds: [successEmbed],
                components: []
            }).catch(() => {});

            // Reply in main channel
            message.reply({
                content: `🚀 **تم حذف ${deletedCount} رول بنجاح!** (أقل من رتبة البوت) ✅`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});

            collector.stop();
        });

        collector.on('end', () => {
            if (confirmMsg) {
                confirmMsg.edit({ components: [] }).catch(() => {});
            }
        });
    }
};

