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
            interactionToken: interaction.token
        };

        // Add current members in VC
        voiceChannel.members.forEach(member => {
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
        });

        timerManager.startTimer(voiceChannel.id, timerData);
        
        // Initial members tracking
        voiceChannel.members.forEach(member => timerManager.addParticipant(voiceChannel.id, member.id));

        // 3. Rendering & Loop
        let lastManualRefresh = 0;
        const renderAndSend = async () => {
            const currentTimer = timerManager.getTimer(voiceChannel.id);
            if (!currentTimer) return;

            const buffer = await drawTimer(currentTimer, theme || {});
            const attachment = new AttachmentBuilder(buffer, { name: 'timer.png' });
            
            // Create Embed Wrapper (Purple Theme)
            const embed = new EmbedBuilder()
                .setTitle('⏳ جلسة المذاكرة النشطة')
                .setDescription(`جاري المذاكرة في <#${voiceChannel.id}>`)
                .setColor('#673ab7') // Purple
                .setImage('attachment://timer.png')
                .addFields(
                    { name: '👤 المنظم', value: `\`${currentTimer.starterName}\``, inline: true },
                    { name: '🎭 الثيم', value: `\`${theme.name || 'Default'}\``, inline: true },
                    { name: '🔄 الجولة', value: `\`${currentTimer.currentCycle}/${currentTimer.totalCycles}\``, inline: true }
                )
                .setTimestamp();

            const stopButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`timer_stop_${voiceChannel.id}`)
                    .setLabel('إيقاف المؤقت')
                    .setStyle(ButtonStyle.Danger)
            );

            // Logic: Edit vs New Message
            if (!currentTimer.messageId) {
                const msg = await interaction.editReply({ 
                    embeds: [embed],
                    files: [attachment], 
                    components: [stopButton] 
                });
                currentTimer.messageId = msg.id;
            } else if (currentTimer.updateMode === 'new') {
                try {
                    const oldMsg = await interaction.channel.messages.fetch(currentTimer.messageId);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}

                const newMsg = await interaction.channel.send({ 
                    embeds: [embed],
                    files: [attachment], 
                    components: [stopButton] 
                });
                currentTimer.messageId = newMsg.id;
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

        // 4. Tick Interval (Main Loop)
        const intervalId = setInterval(async () => {
            const timer = timerManager.getTimer(voiceChannel.id);
            if (!timer) {
                clearInterval(intervalId);
                return;
            }

            timerManager.tick(voiceChannel.id);

            // Switching Logic
            if (timer.status === 'finished') {
                if (timer.mode === 'study') {
                    // --- REWARD / SHOUTOUT: Find the #1 participant ---
                    const sorted = Object.entries(timer.participants)
                        .sort(([, timeA], [, timeB]) => timeB - timeA);
                    
                    if (sorted.length > 0) {
                        const [topUserId, totalSecs] = sorted[0];
                        if (totalSecs > 0) {
                            await interaction.channel.send(`🥇 **مبروك يا <@${topUserId}>!** أنت المركز الأول في هذي السايكل، عاش بطل! كمل بالتوفيق.`);
                        }
                    }

                    // Transition to Break
                    timer.mode = 'break';
                    timer.totalTime = timer.breakTime;
                    timer.timeLeft = timer.breakTime;
                    timer.status = 'running';
                    await interaction.channel.send(`🔔 **انتهى وقت المذاكرة!** حان وقت البريك يا شباب (${breakTime} دقائق). <#${voiceChannel.id}>`);
                } else {
                    // Break Finished
                    if (timer.currentCycle < timer.totalCycles) {
                        // Next Cycle Study
                        timer.currentCycle++;
                        timer.mode = 'study';
                        timer.totalTime = timer.studyTime;
                        timer.timeLeft = timer.studyTime;
                        timer.status = 'running';
                        await interaction.channel.send(`📚 **انتهى البريك!** لنبدأ الدورة رقم ${timer.currentCycle} من المذاكرة (${studyTime} دقائق). <#${voiceChannel.id}>`);
                    } else {
                        // All cycles finished
                        // --- CLEANUP: Delete the timer message ---
                        try {
                            const currentTimer = timerManager.getTimer(voiceChannel.id);
                            if (currentTimer && currentTimer.messageId) {
                                if (currentTimer.updateMode === 'new') {
                                    const lastMsg = await interaction.channel.messages.fetch(currentTimer.messageId);
                                    if (lastMsg) await lastMsg.delete();
                                } else {
                                    await interaction.deleteReply();
                                }
                            }
                        } catch (e) {}

                        clearInterval(intervalId);
                        timerManager.stopTimer(voiceChannel.id);
                        await interaction.channel.send(`🏆 **مبروك!** تم الانتهاء من جميع الدورات (${totalCycles} دورات). أحسنتم العمل! <#${voiceChannel.id}>`);
                        return;
                    }
                }
            }

            // Update UI: Every 15 seconds or at the very end
            if (timer.timeLeft % 15 === 0 || timer.timeLeft < 5) {
                await renderAndSend();
            }
        }, 1000);

        timerData.intervalId = intervalId;
    },
};
