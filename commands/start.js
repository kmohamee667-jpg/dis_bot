const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { drawTimer } = require('../utils/timerCanvas');
const timerThemes = require('../data/themes.json');

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
        .addStringOption(option => {
            option.setName('theme')
                .setDescription('اختر ثيم التايمر')
                .setRequired(true);
            
            // Dynamic choices with Emojis
            Object.keys(timerThemes).forEach(key => {
                const themeData = timerThemes[key];
                const choiceName = `${themeData.emoji || '🖼️'} ${themeData.name || key}`;
                option.addChoices({ name: choiceName, value: key });
            });
            return option;
        })
        .addStringOption(option => 
            option.setName('update_mode')
                .setDescription('طريقة تحديث التايمر (الاختيار التلقائي: تحديث نفس الرسالة)')
                .addChoices(
                    { name: 'تحديث نفس الرسالة (Default)', value: 'edit' },
                    { name: 'إرسال رسالة جديدة', value: 'new' }
                )),
    async execute(interaction) {
        const studyTime = interaction.options.getInteger('study_time');
        const breakTime = interaction.options.getInteger('break_time');
        const totalCycles = interaction.options.getInteger('cycles');
        const themeKey = interaction.options.getString('theme');
        const updateMode = interaction.options.getString('update_mode') || 'edit';
        const theme = timerThemes[themeKey];

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
            totalTime: studyTime * 60, // Start with study
            timeLeft: studyTime * 60,
            mode: 'study',
            updateMode: updateMode,
            currentCycle: 1,
            totalCycles: totalCycles,
            themeKey: themeKey,
            participantNames: {}, 
            participantAvatars: {}, 
            messageId: null,
            interactionToken: interaction.token,
            startTime: Date.now() // Add precise start time
        };

        // Add current members in VC (EXCLUDING BOTS)
        voiceChannel.members.forEach(member => {
            if (member.user.bot) return; // Skip Apps/Bots
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        });

        timerManager.startTimer(voiceChannel.id, timerData);
        
        // Initial members tracking (EXCLUDING BOTS)
        voiceChannel.members.forEach(member => {
            if (!member.user.bot) timerManager.addParticipant(voiceChannel.id, member.id);
        });

        // 3. Rendering & Loop
        let lastManualRefresh = 0;

        // Delete all messages in the text channel except the timer message (if exists)
        const purgeChatExceptTimer = async (timerMessageId) => {
            try {
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const toDelete = messages.filter(msg => msg.id !== timerMessageId);
                if (toDelete.size > 0) {
                    // bulkDelete only works for messages <14 days old
                    const deletable = toDelete.filter(msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
                    if (deletable.size > 0) {
                        await interaction.channel.bulkDelete(deletable, true).catch(() => {});
                    }
                }
            } catch (e) {
                console.error('Failed to purge chat except timer:', e);
            }
        };

        const renderAndSend = async () => {
            const currentTimer = timerManager.getTimer(voiceChannel.id);
            if (!currentTimer) return;

            const buffer = await drawTimer(currentTimer, theme || {});
            const attachment = new AttachmentBuilder(buffer, { name: 'timer.png' });
            
            // Create Premium Embed Wrapper (Purple Theme with Border)
            const embed = new EmbedBuilder()
                .setTitle('⏳ جلسة المذاكرة النشطة')
                .setDescription(`> جاري المذاكرة والتركيز الآن في <#${voiceChannel.id}>\n> ممنوع الإزعاج 🤫`)
                .setColor('#673ab7') // Deep Purple Border
                .setImage('attachment://timer.png')
                .addFields(
                    { name: '👤 المنظم', value: `\`${currentTimer.starterName}\``, inline: true },
                    { name: '🎭 الثيم', value: `\`${theme.name || 'Default'}\``, inline: true },
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

            // Logic: Edit vs New Message (force new occasionally on cycle reset)
            const isFirstRender = !currentTimer.messageId;
            const shouldRepost = currentTimer.shouldRepost || currentTimer.updateMode === 'new';

            if (isFirstRender) {
                const msg = await interaction.editReply({
                    embeds: [embed],
                    files: [attachment],
                    components: [stopButton]
                });
                currentTimer.messageId = msg.id;
                currentTimer.shouldRepost = false;
            } else if (shouldRepost) {
                // Delete existing timer message and repost as new at bottom
                try {
                    const oldMsg = await interaction.channel.messages.fetch(currentTimer.messageId);
                    if (oldMsg) await oldMsg.delete().catch(() => {});
                } catch (e) {}

                // Purge other messages from channel (keep one timer message)
                await purgeChatExceptTimer(currentTimer.messageId);

                const newMsg = await interaction.channel.send({
                    embeds: [embed],
                    files: [attachment],
                    components: [stopButton]
                });
                currentTimer.messageId = newMsg.id;
                currentTimer.shouldRepost = false;
                currentTimer.updateMode = 'edit';
            } else {
                await interaction.editReply({
                    embeds: [embed],
                    files: [attachment],
                    components: [stopButton]
                }).catch(() => {});
            }
        };

        // Allow external triggers (voiceStateUpdate) to refresh UI
        timerData.refreshCallback = async () => {
            const now = Date.now();
            if (now - lastManualRefresh < 3000) return; // Debounce 3s
            lastManualRefresh = now;
            await renderAndSend();
        };

        await renderAndSend();

        // Small delay to ensure first render is complete before starting timer
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4. Tick Interval (Main Loop) - Ticks & refreshes UI every 10 seconds
        const intervalId = setInterval(async () => {
            const timer = timerManager.getTimer(voiceChannel.id);
            if (!timer) {
                clearInterval(intervalId);
                return;
            }

            // Advance the timer clock
            timerManager.tick(voiceChannel.id, voiceChannel);

            // Handle state transitions when a phase finishes
            if (timer.status === 'finished') {
                if (timer.mode === 'study') {
                    // Reward the top participant
                    const sorted = Object.entries(timer.participants)
                        .sort(([, a], [, b]) => b - a);

                    if (sorted.length > 0) {
                        const [topUserId, totalSecs] = sorted[0];
                        if (totalSecs > 0) {
                            const rewardEmbed = new EmbedBuilder()
                                .setTitle('🥇 بطل السايكل!')
                                .setDescription(`مبروك يا <@${topUserId}>! أنت المركز الأول في هذه الدورة، عاش يا وحش! استمر على هذا المنوال. 🔥`)
                                .setColor('#FFD700')
                                .setTimestamp();
                            await interaction.channel.send({ embeds: [rewardEmbed] }).catch(() => {});
                        }
                    }

                    // Transition to break phase
                    timer.mode = 'break';
                    timer.totalTime = timer.breakTime;
                    timer.timeLeft = timer.breakTime;
                    timer.status = 'running';

                    const breakEmbed = new EmbedBuilder()
                        .setTitle('🔔 وقت البريك!')
                        .setDescription(`انتهى وقت المذاكرة! حان وقت الراحة الآن لمدة **${breakTime} دقائق**. استمتع ببريكك! ☕`)
                        .setColor('#3498DB')
                        .setTimestamp();
                    await interaction.channel.send({ embeds: [breakEmbed] }).catch(() => {});

                } else {
                    // Break finished
                    if (timer.currentCycle < timer.totalCycles) {
                        // Move to next study cycle
                        timer.currentCycle++;
                        timer.mode = 'study';
                        timer.totalTime = timer.studyTime;
                        timer.timeLeft = timer.studyTime;
                        timer.status = 'running';

                        const nextCycleEmbed = new EmbedBuilder()
                            .setTitle('📚 العودة للمذاكرة!')
                            .setDescription(`انتهى البريك! لنبدأ الدورة رقم **${timer.currentCycle}** من المذاكرة لمدة **${studyTime} دقائق**. اترك الجوال وركز! 💪`)
                            .setColor('#E67E22')
                            .setTimestamp();
                        await interaction.channel.send({ embeds: [nextCycleEmbed] }).catch(() => {});

                        // Force repost timer at bottom after break-to-study switch
                        timer.shouldRepost = true;
                        await renderAndSend().catch(() => {});

                    } else {
                        // All cycles done — cleanup and announce
                        clearInterval(intervalId);

                        try {
                            if (timer.messageId) {
                                const msgToDelete = await interaction.channel.messages.fetch(timer.messageId).catch(() => null);
                                if (msgToDelete) await msgToDelete.delete().catch(() => {});
                            }
                        } catch (e) {}

                        timerManager.stopTimer(voiceChannel.id);

                        const finishedEmbed = new EmbedBuilder()
                            .setTitle('🏆 تم الإنجاز!')
                            .setDescription(`مبروك! تم الانتهاء من جميع الدورات (**${totalCycles} دورات**). فخورين بك وبمجهودك! اذهب وخذ قسطاً من الراحة. ❤️`)
                            .setColor('#2ECC71')
                            .setTimestamp();
                        await interaction.channel.send({ embeds: [finishedEmbed] }).catch(() => {});
                        return;
                    }
                }
            }

            // Refresh the timer image every 10 seconds
            await renderAndSend().catch(err => console.error('Timer render error:', err));
        }, 10000);

        timerData.intervalId = intervalId;
    },
};
