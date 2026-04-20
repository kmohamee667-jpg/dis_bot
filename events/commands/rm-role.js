const { EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ADMIN_USERNAME = 'khal3d0047';

module.exports = {
    name: 'rm-role',
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

        // Parse role name from command
        const args = message.content.trim().split(/ +/);
        const roleName = args.slice(1).join(' '); // Join all args after 'rm-role'
        
        if (!roleName || roleName.length < 2) {
            return message.reply({
                content: '❌ **الاستخدام: `!rm-role اسم الرول`**\\nمثال: `!rm-role @VIP`',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }

        // Find role by name (case-insensitive, partial match)
        const role = message.guild.roles.cache.find(r => 
            r.name.toLowerCase() === roleName.toLowerCase() || 
            r.name.toLowerCase().includes(roleName.toLowerCase().trim().replace(/[<@&>]/g, ''))
        );

        if (!role) {
            return message.reply({
                content: `❌ **لم يتم العثور على رول:** \`${roleName}\`\\nتأكد من اسم الرول الصحيح.`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }

        if (!role.deletable) {
            return message.reply({
                content: `❌ **لا يمكن حذف الرول:** ${role.name}\\n(صلاحيات أو رتبة أعلى من البوت)`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }

        // Button confirmation
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ تأكيد حذف رول واحد')
            .setDescription(`**هل تريد حذف الرول:** <@&${role.id}> \`${role.name}\` (Position: ${role.position})?**`)
            .addFields({ name: 'عدد الأعضاء', value: `${role.members.size.toLocaleString()}`, inline: true })
            .setColor('#FF6B6B')
            .setFooter({ text: `فقط ${ADMIN_USERNAME} | ID: ${role.id}` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_rm_role_${role.id}`)
                    .setLabel('حذف الرول')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_rm_role')
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
        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 30000 });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            
            if (interaction.customId === 'cancel_rm_role') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('❌ **تم إلغاء حذف الرول**')
                    .setColor('#00FF00');
                await confirmMsg.edit({ embeds: [cancelEmbed], components: [] }).catch(() => {});
                return collector.stop();
            }

            // Confirm it's the same role
            const targetRole = interaction.guild.roles.cache.get(role.id);
            if (!targetRole || !targetRole.deletable) {
                return await confirmMsg.edit({
                    content: '❌ **الرول غير موجود أو لا يمكن حذفه الآن.**',
                    embeds: [], components: []
                }).catch(() => {});
            }

            try {
                await targetRole.delete('rm-role command');
                console.log(`🗑️ Deleted specific role: ${targetRole.name} (ID: ${targetRole.id}) by ${ADMIN_USERNAME}`);

                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ تم حذف الرول')
                    .setDescription(`**تم حذف:** <@&${role.id}> \`${role.name}\``)
                    .addFields(
                        { name: 'الأعضاء', value: `${role.members.size.toLocaleString()}`, inline: true },
                        { name: 'الموقع', value: `Position ${role.position}`, inline: true }
                    )
                    .setColor('#00FF00')
                    .setTimestamp();

                await confirmMsg.edit({ embeds: [successEmbed], components: [] }).catch(() => {});

                message.reply(`🗑️ **تم حذف الرول:** \`${role.name}\` ✅`).catch(() => {});

            } catch (e) {
                console.error(`❌ Failed rm-role ${role.name}:`, e);
                const failEmbed = new EmbedBuilder()
                    .setDescription(`❌ **فشل حذف الرول:** ${role.name}\\n\`${e.message}\``)
                    .setColor('#E74C3C');
                await confirmMsg.edit({ embeds: [failEmbed], components: [] }).catch(() => {});
            }

            collector.stop();
        });

        collector.on('end', () => {
            confirmMsg.edit({ components: [] }).catch(() => {});
        });
    }
};

