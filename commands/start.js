const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { validateGuild } = require('../utils/guildValidator');
const { drawTimer, drawLeaderboard } = require('../utils/timerCanvas');
const { getThemeChoices } = require('../utils/themesDb');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('بدأ تايمر المذاكرة (Pomodoro)')
        .addIntegerOption(option =>
            option.setName('study_time')
                .setDescription('وقت الدراسة بالدقائق')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('break_time')
                .setDescription('وقت البريك بالدقائق')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cycles')
                .setDescription('عدد الدورات (دراسة + بريك)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('theme')
                .setDescription('اختر ثيم التايمر')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('update_mode')
                .setDescription('طريقة تحديث التايمر (الاختيار التلقائي: تحديث نفس الرسالة)')
                .addChoices(
                    { name: 'تحديث نفس الرسالة (Default)', value: 'edit' },
                    { name: 'إرسال رسالة جديدة', value: 'new' }
                )),

    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        const studyTime = interaction.options.getInteger('study_time');
        const breakTime = interaction.options.getInteger('break_time');
        const totalCycles = interaction.options.getInteger('cycles');
        const themeKey = interaction.options.getString('theme');
        const updateMode = interaction.options.getString('update_mode') || 'edit';
        const themeDb = require('../utils/themesDb');
        const theme = await themeDb.getTheme(themeKey) || {};


        // 1. Validation
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({ content: '❌ يجب أن تكون في غرفة صوتية لتبدأ التايمر!', flags: [MessageFlags.Ephemeral] });
        }

        if (timerManager.hasTimer(voiceChannel.id)) {
            return await interaction.reply({ content: '⚠️ هناك تايمر يعمل بالفعل في هذه الغرفة!', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply();

        // 2. Initial Setup
        const timerData = {
            guildId: interaction.guildId,
            channelId: voiceChannel.id,
            starterId: interaction.user.id,
            starterName: interaction.member.displayName || interaction.user.username,
            studyTime: studyTime * 60,
            breakTime: breakTime * 60,
            totalTime: studyTime * 60,
            timeLeft: studyTime * 60,
            mode: 'study',
            updateMode: updateMode,
            currentCycle: 1,
            totalCycles: totalCycles,
            themeKey: themeKey,
            participantNames: {},
            participantAvatars: {},
            messageId: null,
            messageObj: null,   // ← stored Message object to avoid interaction token expiry
            startTime: Date.now()
        };

        voiceChannel.members.forEach(member => {
            if (member.user.bot) return;
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        });

        timerManager.startTimer(voiceChannel.id, timerData);

        voiceChannel.members.forEach(member => {
            if (!member.user.bot) timerManager.addParticipant(voiceChannel.id, member.id);
        });

        // 3. Build the timer embed + components
        const buildPayload = async (currentTimer) => {
            const buffer = await drawTimer(currentTimer, theme || {});
            const attachment = new AttachmentBuilder(buffer, { name: 'timer.png' });

            const embed = new EmbedBuilder()
                .setTitle('⏳ جلسة المذاكرة النشطة')
                .setDescription(`> جاري المذاكرة والتركيز الآن في <#${voiceChannel.id}>\n> ممنوع الإزعاج 🤫`)
                .setColor('#673ab7')
                .setImage('attachment://timer.png')
                .addFields(
                    { name: '👤 المنظم', value: `\`${currentTimer.starterName}\``, inline: true },
                    { name: '🎭 الثيم', value: `\`${theme?.name || 'Default'}\``, inline: true },
                    { name: '🔄 الجولة', value: `\`${currentTimer.currentCycle}/${currentTimer.totalCycles}\``, inline: true }
                )
                .setFooter({ text: 'Antigravity Timer System • بالتوفيق يا بطل!', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const stopButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`timer_stop_${voiceChannel.id}`)
                    .setLabel('إيقاف المؤقت')
                    .setStyle(ButtonStyle.Danger)
            );

            return { embeds: [embed], files: [attachment], components: [stopButton] };
        };

        // 4. Render & send/edit the timer message
        //    — First call: tries interaction.editReply(), falls back to channel.send() if token expired
        //    — All subsequent calls: message.edit() directly (no 15-min limit)
        let lastManualRefresh = 0;
        const renderAndSend = async () => {
            const currentTimer = timerManager.getTimer(voiceChannel.id);
            if (!currentTimer) return;

            const payload = await buildPayload(currentTimer);

            if (!currentTimer.messageObj) {
                // No message yet — try editReply, fall back to channel.send if expired
                let msg;
                try {
                    msg = await interaction.editReply(payload);
                } catch (_) {
                    msg = await interaction.channel.send(payload);
                }
                currentTimer.messageObj = msg;
                currentTimer.messageId = msg.id;

            } else if (currentTimer.updateMode === 'new') {
                // "new" mode — always delete + resend
                try { await currentTimer.messageObj.delete(); } catch (_) {}
                const newMsg = await interaction.channel.send(payload);
                currentTimer.messageObj = newMsg;
                currentTimer.messageId = newMsg.id;

            } else {
                // Edit mode — use stored Message object (no 15-min expiry)
                await currentTimer.messageObj.edit(payload).catch(err => {
                    console.error('Timer message edit failed:', err.message);
                });
            }
        };

        // Helper: resend timer at the bottom of chat, keeping messageId valid at ALL times
        const resendAtBottom = async (timer) => {
            const oldObj = timer.messageObj;
            const currentTimer = timerManager.getTimer(voiceChannel.id);
            if (!currentTimer) return;

            // Build & send the new message FIRST so messageId is never null/unprotected
            const payload = await buildPayload(currentTimer);
            const newMsg = await interaction.channel.send(payload);
            currentTimer.messageObj = newMsg;
            currentTimer.messageId = newMsg.id;

            // Delete the old message only AFTER the new one is live
            if (oldObj) { try { await oldObj.delete(); } catch (_) {} }
        };

        // Allow voiceStateUpdate events to trigger a refresh
        timerData.refreshCallback = async () => {
            const now = Date.now();
            if (now - lastManualRefresh < 3000) return;
            lastManualRefresh = now;
            await renderAndSend().catch(() => {});
        };

        // Initial render
        await renderAndSend();
        await new Promise(resolve => setTimeout(resolve, 100));

        // 5. Main loop — ticks and refreshes every 10 seconds
        const intervalId = setInterval(async () => {
            const timer = timerManager.getTimer(voiceChannel.id);
            if (!timer) {
                clearInterval(intervalId);
                return;
            }

            await timerManager.tick(voiceChannel.id, voiceChannel);

            if (timer.status === 'finished') {
                if (timer.mode === 'study') {


                    // Transition to break
                    timer.mode = 'break';
                    timer.totalTime = timer.breakTime;
                    timer.timeLeft = timer.breakTime;
                    timer.status = 'running';

                    // ✅ حفظ التغيير في قاعدة البيانات
                    await timerManager.updateCycleInDb(voiceChannel.id, timer.currentCycle, 'break');

                    // Mention all voice members before break
                    const voiceChannelObj = interaction.guild.channels.cache.get(voiceChannel.id);
                    const mentions = voiceChannelObj?.members.filter(m => !m.user.bot).map(m => `<@${m.id}>`).join(' ') || '@everyone';
                    const mentionEmbed = new EmbedBuilder()
                        .setTitle('🔔 وقت البريك للجميع!')
                        .setDescription(`${mentions}\n\nانتهى وقت المذاكرة! حان وقت الراحة الآن لمدة **${breakTime} دقائق**. استمتع ببريكك! ☕`)
                        .setColor('#3498DB')
                        .setTimestamp();
                    await interaction.channel.send({ embeds: [mentionEmbed] }).catch(() => {});

                    // Unlock text channel if locked
                    const everyoneRole = interaction.guild.roles.everyone;
                    const perms = interaction.channel.permissionsFor(everyoneRole);
                    if (!perms.has('SendMessages')) {
                        await interaction.channel.permissionOverwrites.edit(everyoneRole, { SendMessages: true }).catch(() => {});
                    }

                    const breakEmbed = new EmbedBuilder()
                        .setTitle('🔔 وقت البريك!')
                        .setDescription(`انتهى وقت المذاكرة! حان وقت الراحة الآن لمدة **${breakTime} دقائق**. استمتع ببريكك! ☕`)
                        .setColor('#3498DB')
                        .setTimestamp();
                    await interaction.channel.send({ embeds: [breakEmbed] }).catch(() => {});
                    await resendAtBottom(timer);

                } else {
                    // Break finished
                    if (timer.currentCycle < timer.totalCycles) {
                        timer.currentCycle++;
                        timer.mode = 'study';
                        timer.totalTime = timer.studyTime;
                        timer.timeLeft = timer.studyTime;
                        timer.status = 'running';

                        // ✅ حفظ التغيير في قاعدة البيانات
                        await timerManager.updateCycleInDb(voiceChannel.id, timer.currentCycle, 'study');

                        const nextCycleEmbed = new EmbedBuilder()
                            .setTitle('📚 العودة للمذاكرة!')
                            .setDescription(`انتهى البريك! لنبدأ الدورة رقم **${timer.currentCycle}** من المذاكرة لمدة **${studyTime} دقائق**. اترك الجوال وركز! 💪`)
                            .setColor('#E67E22')
                            .setTimestamp();
                        await interaction.channel.send({ embeds: [nextCycleEmbed] }).catch(() => {});
                        await resendAtBottom(timer);

                    } else {
                        // All cycles complete
                        clearInterval(intervalId);

                        try {
                            if (timer.messageObj) await timer.messageObj.delete().catch(() => {});
                        } catch (_) {}

                        timerManager.stopTimer(voiceChannel.id);

                        // Generate final leaderboard
                        const topUsers = timerManager.getGuildTopStudy(interaction.guildId, 20);
                        const guildMembers = interaction.guild.members.cache;
                        const leaderboardBuffer = await drawLeaderboard(topUsers, guildMembers, interaction.guildId, interaction.user.id, theme);
                        const leaderboardAttachment = new AttachmentBuilder(leaderboardBuffer, { name: 'leaderboard.png' });

                        const finishedEmbed = new EmbedBuilder()
                            .setTitle('🏆 تم الإنجاز - النتائج النهائية!')
                            .setDescription(`مبروك! تم الانتهاء من جميع الدورات (**${totalCycles} دورات**). فخورين بكم! 🎉\n\nشوفوا الليدربورد أسفل 👇`)
                            .setColor('#2ECC71')
                            .setImage('attachment://leaderboard.png')
                            .setTimestamp();
                        await interaction.channel.send({ embeds: [finishedEmbed], files: [leaderboardAttachment] }).catch(() => {});

                        // REMOVED: Final "تم الإنجاز" message
                        return;
                    }
                }
            }

            // Refresh the timer image every 10 seconds
            await renderAndSend().catch(err => console.error('Timer render error:', err.message));
        }, 10000);

        timerData.intervalId = intervalId;
    },
};
