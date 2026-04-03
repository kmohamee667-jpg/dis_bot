const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const timerManager = require('../utils/timerManager');
const { validateGuild } = require('../utils/guildValidator');
const { drawTimer } = require('../utils/timerCanvas');
const { getThemeChoicesSync } = require('../utils/themesDb');
const { isAdmin } = require('../utils/admin-check');

const CHALLENGE_SUMMARY_CHANNEL = '1487708777678635048';

function formatMentions(rank) {
    if (!rank || rank.length === 0) return '*لا يوجد مشاركين حتى الآن*';
    return rank.map((item, idx) => `**${idx + 1}.** <@${item.userId}> - \`${Math.floor(item.seconds / 60)}m ${item.seconds % 60}s\``).join('\n');
}

async function updateChallengeSummary(client, timer, cycleDoneInfo = null, final = false) {
    const channel = client.channels.cache.get(CHALLENGE_SUMMARY_CHANNEL) || await client.channels.fetch(CHALLENGE_SUMMARY_CHANNEL).catch(() => null);
    if (!channel) return;

    const totalParticipants = Object.keys(timer.participants || {}).length;
    const overallSorted = Object.entries(timer.participants || {})
        .map(([userId, seconds]) => ({ userId, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 3);

    const currentCycle = timer.currentCycle;
    const totalCycles = timer.totalCycles;

    const cycleTitle = !cycleDoneInfo ? 'بدء التحدي' : `انتهت دورة ${cycleDoneInfo.cycle}`;
    const cycleLeaders = cycleDoneInfo ? cycleDoneInfo.cycleLeaders : [];

    const embed = new EmbedBuilder()
        .setTitle(final ? '🏁 نتائج التحدي النهائي' : `📣 تقرير تحدي غرفة <#${timer.channelId}>`)
        .setDescription(`
**الحالة:** ${final ? 'تم الانتهاء من التحدي' : `${currentCycle}/${totalCycles} دورة`}
**المشاركون الكليين:** ${totalParticipants}
${cycleDoneInfo ? `**أقوى دورة:** ${cycleDoneInfo.cycle}` : ''}
        `)
        .setColor(final ? '#2ECC71' : '#9B59B6')
        .addFields(
            { name: '🥇 أفضل 3 في هذه الدورة', value: formatMentions(cycleLeaders) || 'لا بيانات', inline: false },
            { name: '🏆 ترتيب عام (أعلى 3)', value: formatMentions(overallSorted) || 'لا بيانات', inline: false }
        )
        .setFooter({ text: 'تحدي الوقت • تحديث كل دورة تلقائي', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    // image placeholder for top scorers
    embed.setImage(`https://via.placeholder.com/700x200.png?text=${encodeURIComponent(final ? 'Final+Champion' : `Cycle+${currentCycle}`)}`);

    if (timer.challengeSummaryMessageId) {
        const existingMsg = await channel.messages.fetch(timer.challengeSummaryMessageId).catch(() => null);
        if (existingMsg) {
            return await existingMsg.edit({ embeds: [embed] }).catch(() => null);
        }
    }

    const newMsg = await channel.send({ embeds: [embed] }).catch(() => null);
    if (newMsg) timer.challengeSummaryMessageId = newMsg.id;
}

function buildData() {
    const builder = new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('ابدأ تحدي مذاكرة دوري (سلسلة + إمكانية استكمال يدوي)')
        .addIntegerOption(option => option.setName('study_time').setDescription('وقت الدراسة بالدقائق').setRequired(true))
        .addIntegerOption(option => option.setName('break_time').setDescription('وقت البريك بالدقائق').setRequired(true))
        .addIntegerOption(option => option.setName('cycles').setDescription('عدد الدورات (دراسة + بريك)').setRequired(true))
        .addStringOption(option => {
            option.setName('theme').setDescription('اختر ثيم التايمر').setRequired(true);
            const choices = getThemeChoicesSync();
            if (choices.length > 0) choices.forEach(choice => option.addChoices(choice));
            return option;
        })
        .addStringOption(option => option.setName('cycle_mode').setDescription('وضع السايكل').setRequired(true).addChoices({ name: 'تشغيل متواصل', value: 'auto' }, { name: 'انتظار استكمال يدوي', value: 'manual' }))
        .addStringOption(option => option.setName('update_mode').setDescription('طريقة تحديث رسالة التايمر').addChoices({ name: 'تحديث نفس الرسالة', value: 'edit' }, { name: 'إرسال رسالة جديدة', value: 'new' }));
    return builder;
}

module.exports = {
    data: buildData(),
    buildData,

    async execute(interaction) {
        // ✅ التحقق من Guild ID
        if (!await validateGuild(interaction)) return;

        if (!isAdmin(interaction, 'challenge')) {
            return await interaction.reply({ content: '❌ ليس لديك صلاحية استخدام هذا الأمر.', flags: [MessageFlags.Ephemeral] });
        }

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return await interaction.reply({ content: '❌ يجب أن تكون في غرفة صوتية لتبدأ التحدي.', flags: [MessageFlags.Ephemeral] });
        }

        if (timerManager.hasTimer(voiceChannel.id)) {
            return await interaction.reply({ content: '⚠️ هناك تحدي/تايمر يعمل حاليًا في هذه الغرفة.', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply();

        const studyTime = interaction.options.getInteger('study_time');
        const breakTime = interaction.options.getInteger('break_time');
        const totalCycles = interaction.options.getInteger('cycles');
        const themeKey = interaction.options.getString('theme');
        const updateMode = interaction.options.getString('update_mode') || 'edit';
        const cycleMode = interaction.options.getString('cycle_mode') || 'auto';
        const theme = await require('../utils/themesDb').getTheme(themeKey);


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
            status: 'running',
            updateMode,
            currentCycle: 1,
            totalCycles,
            themeKey,
            cycleMode,
            waitingContinue: false,
            challengeSummaryMessageId: null,
            cycleParticipants: {},
            challengeCycleResults: [],
            participantNames: {},
            participantAvatars: {},
            currentParticipants: new Set(),
            messageId: null,
            interactionToken: interaction.token
        };

        voiceChannel.members.forEach(member => {
            if (member.user.bot) return;
            timerData.participantNames[member.id] = member.displayName || member.user.username;
            timerData.participantAvatars[member.id] = member.user.displayAvatarURL({ extension: 'png', size: 128 });
            timerData.currentParticipants.add(member.id);
        });

        timerManager.startTimer(voiceChannel.id, timerData);
        voiceChannel.members.forEach(member => {
            if (!member.user.bot) timerManager.addParticipant(voiceChannel.id, member.id);
        });

        let lastManualRefresh = 0;

        const renderAndSend = async () => {
            const currentTimer = timerManager.getTimer(voiceChannel.id);
            if (!currentTimer) return;

            const buffer = await drawTimer(currentTimer, theme || {});
            const attachment = new AttachmentBuilder(buffer, { name: 'timer.png' });

            const totalStudySeconds = Object.values(currentTimer.participants || {}).reduce((sum, s) => sum + (s || 0), 0);
            const totalStudyFormatted = `${Math.floor(totalStudySeconds / 60)}m ${totalStudySeconds % 60}s`;

            const topParticipants = Object.entries(currentTimer.participants || {})
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([userId, seconds], idx) => `**${idx + 1}.** <@${userId}> - ${Math.floor(seconds / 60)}m ${seconds % 60}s`)
                .join('\n') || '*لا يوجد بيانات*';

            const embed = new EmbedBuilder()
                .setTitle('⏳ تحدي المذاكرة نشط')
                .setDescription(`> تحدي في غرفة <#${voiceChannel.id}> \n> الوضع: **${cycleMode === 'auto' ? 'متواصل' : 'منتظر استكمال'}**`)
                .setColor('#673ab7')
                .setImage('attachment://timer.png')
                .addFields(
                    { name: '👤 المنظم', value: `\`${timerData.starterName}\``, inline: true },
                    { name: '🎭 الثيم', value: `\`${theme.name || 'Default'}\``, inline: true },
                    { name: '🔄 الدورة', value: `\`${currentTimer.currentCycle}/${currentTimer.totalCycles}\``, inline: true },
                    { name: '⏱️ المرحلة', value: `\`${currentTimer.mode}\``, inline: true },
                    { name: '🕒 Study Time', value: `\`${totalStudyFormatted}\``, inline: true },
                    { name: '💰 عروض الكوينز (Top 3)', value: topParticipants, inline: false }
                )
                .setFooter({ text: 'Challenge Timer System', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const stopButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`timer_stop_${voiceChannel.id}`).setLabel('إيقاف التحدي').setStyle(ButtonStyle.Danger)
            );

            if (!currentTimer.messageId) {
                const msg = await interaction.editReply({ embeds: [embed], files: [attachment], components: [stopButton] });
                currentTimer.messageId = msg.id;
            } else if (currentTimer.updateMode === 'new') {
                try {
                    const oldMsg = await interaction.channel.messages.fetch(currentTimer.messageId);
                    if (oldMsg) await oldMsg.delete();
                } catch (e) {}

                const newMsg = await interaction.channel.send({ embeds: [embed], files: [attachment], components: [stopButton] });
                currentTimer.messageId = newMsg.id;
            } else {
                await interaction.editReply({ embeds: [embed], files: [attachment], components: [stopButton] }).catch(() => {});
            }
        };

        timerData.refreshCallback = async () => {
            const now = Date.now();
            if (now - lastManualRefresh < 3000) return;
            lastManualRefresh = now;
            await renderAndSend();
        };

        await updateChallengeSummary(interaction.client, timerData, null, false);
        await renderAndSend();

        const intervalId = setInterval(async () => {
            const timer = timerManager.getTimer(voiceChannel.id);
            if (!timer) {
                clearInterval(intervalId);
                return;
            }

            if (timer.status !== 'running') return;

            timerManager.tick(voiceChannel.id, voiceChannel);

            if (timer.status === 'finished') {
                if (timer.mode === 'study') {
                    const cycle = timer.currentCycle;
                    const cycleScores = Object.entries(timer.cycleParticipants || {}).map(([userId, seconds]) => ({ userId, seconds }));
                    const cycleSorted = cycleScores.sort((a, b) => b.seconds - a.seconds).slice(0, 3);

                    timer.challengeCycleResults.push({ cycle, top3: cycleSorted });

                    await updateChallengeSummary(interaction.client, timer, { cycle, cycleLeaders: cycleSorted }, false);

                    // Switch to break phase (no per-cycle channel log, final summary at end)
                    timer.mode = 'break';
                    timer.totalTime = timer.breakTime;
                    timer.timeLeft = timer.breakTime;
                    timer.status = 'running';
                    timer.cycleParticipants = {};

                } else if (timer.mode === 'break') {
                    if (timer.currentCycle < timer.totalCycles) {
                        if (timer.cycleMode === 'auto') {
                            timer.currentCycle += 1;
                            timer.mode = 'study';
                            timer.totalTime = timer.studyTime;
                            timer.timeLeft = timer.studyTime;
                            timer.status = 'running';
                            timer.cycleParticipants = {};
                        } else {
                            timer.status = 'paused';
                            timer.waitingContinue = true;

                            const continueButton = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`timer_continue_${voiceChannel.id}`).setLabel('استكمال الدورة التالية').setStyle(ButtonStyle.Success)
                            );

                            const continueMsg = await interaction.channel.send({ content: `⏸️ التحدي متوقف الآن حتى يقوم مشرف (أو المصرح له) بالضغط على الاستكمال.`, components: [continueButton] });
                            timer.continueMessageId = continueMsg.id;
                        }
                    } else {
                        // Challenge complete
                        clearInterval(intervalId);
                        timerManager.stopTimer(voiceChannel.id);

                        await updateChallengeSummary(interaction.client, timer, { cycle: timer.currentCycle, cycleLeaders: [] }, true);

                        const overallSorted = Object.entries(timer.participants).map(([userId, seconds]) => ({ userId, seconds })).sort((a, b) => b.seconds - a.seconds).slice(0, 3);
                        const finalWinners = overallSorted.length > 0 ? overallSorted.map((entry, idx) => `**${idx + 1}.** <@${entry.userId}> (${Math.floor(entry.seconds / 60)}m ${entry.seconds % 60}s)`).join('\n') : '*لا يوجد بيانات*';

                        await interaction.channel.send({ embeds: [
                            new EmbedBuilder()
                                .setTitle('🏆 تم الانتهاء من التحدي!')
                                .setDescription(`🎉 تهانينا، انتهت جميع ${timer.totalCycles} دورات.`)
                                .addFields({ name: '🥇 الأوائل على التحدي كامل', value: finalWinners })
                                .setColor('#2ECC71')
                        ], content: `<#${voiceChannel.id}>` });
                    }
                }

                await renderAndSend().catch(() => {});
            }

            // Refresh visual every 15s and near end
            if (timer.status === 'running' && (timer.timeLeft % 15 === 0 || timer.timeLeft < 5)) {
                await renderAndSend().catch(() => {});
            }

        }, 1000);

        timerData.intervalId = intervalId;
    }
};