const db = require('./db');

class TimerManager {
    constructor() {
        this.activeTimers = new Map();
        this.guildStudyTotals = new Map();
        this.heartbeatInterval = null;
    }

    startTimer(channelId, data) {
        data.startTime = data.startTime || Date.now();
        data.participants = data.participants || {};
        data.participantNames = data.participantNames || {};
        data.participantAvatars = data.participantAvatars || {};
        data.participantsCoinsProgress = data.participantsCoinsProgress || {};
        data.currentParticipants = data.currentParticipants || new Set();
        data.lastUpdate = Date.now();
        data.status = data.status || 'running';
        data.starterName = data.starterName || 'System';
        data.isLocked = false;
        this.activeTimers.set(channelId, data);

        // ✅ حفظ التايمر في قاعدة البيانات
        db.saveTimer(data).catch(err =>
            console.error(`❌ Error saving timer for channel ${channelId}:`, err.message)
        );
    }

    getTimer(channelId) {
        return this.activeTimers.get(channelId);
    }

    getGuildTopStudy(guildId, topN = 5) {
        const guildMap = this.guildStudyTotals.get(guildId) || {};
        return Object.entries(guildMap)
            .map(([userId, seconds]) => ({ userId, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, topN);
    }

    stopTimer(channelId, client = null) {
        const timer = this.activeTimers.get(channelId);
        if (timer && client) {
            this.lockChannel(client, timer, false).catch(() => {});
        }
        this.activeTimers.delete(channelId);
        
        // ✅ حذف التايمر من قاعدة البيانات
        db.deleteTimer(channelId).catch(err =>
            console.error(`❌ Error deleting timer for channel ${channelId}:`, err.message)
        );
    }

    hasTimer(channelId) {
        return this.activeTimers.has(channelId);
    }

    addParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.add(userId);
            if (timer.participants[userId] === undefined) {
                timer.participants[userId] = 0;
            }
        }
    }

    removeParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.delete(userId);
        }
    }

    async lockChannel(client, timer, lock) {
        if (!client || !timer || !timer.textChannelId) return;
        const channel = client.channels.cache.get(timer.textChannelId);
        if (!channel) return;

        try {
            const guild = channel.guild;
            const everyone = guild.roles.everyone;
            await channel.permissionOverwrites.edit(everyone, { SendMessages: !lock });
            timer.isLocked = lock;

            // Send notification for Challenges when locking
            if (lock && timer.isChallenge) {
                const voiceChannel = client.channels.cache.get(timer.channelId);
                const mentions = voiceChannel?.members.filter(m => !m.user.bot).map(m => `<@${m.id}>`).join(' ') || '';
                if (mentions) {
                    await channel.send({ 
                        content: `⚠️ **تنبيه: تم قفل الشات الآن!**\nسيتم فتح الشات تلقائياً عند انتهاء هذه الدورة.\n${mentions}` 
                    }).catch(() => {});
                }
            }
        } catch (e) {
            console.error('Failed to update channel permissions:', e.message);
        }
    }

    async tick(channelId, voiceChannel = null) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        // Perform initial lock if just started (Challenges only)
        if (timer.isChallenge && timer.mode === 'study' && !timer.isLocked && timer.status === 'running' && voiceChannel) {
            await this.lockChannel(voiceChannel.client, timer, true);
        }

        const now = Date.now();
        const delta = Math.floor((now - timer.lastUpdate) / 1000);
        if (delta <= 0) return;

        timer.timeLeft = Math.max(0, timer.timeLeft - delta);
        timer.lastUpdate = now;

        if (timer.mode === 'study' && timer.timeLeft > 0) {
            const studyBatch = {};

            timer.currentParticipants.forEach(userId => {
                const username = timer.participantNames[userId] || 'User';

                if (!timer.participants[userId]) timer.participants[userId] = 0;
                timer.participants[userId] += delta;

                if (timer.guildId) {
                    if (!this.guildStudyTotals.has(timer.guildId)) {
                        this.guildStudyTotals.set(timer.guildId, {});
                    }
                    const guildMap = this.guildStudyTotals.get(timer.guildId);
                    guildMap[userId] = (guildMap[userId] || 0) + delta;
                }

                let rate = 1;
                if (voiceChannel) {
                    const member = voiceChannel.members.get(userId);
                    if (member?.voice?.streaming || member?.voice?.selfVideo) rate = 2;
                }

                if (typeof timer.participantsCoinsProgress[userId] !== 'number') {
                    timer.participantsCoinsProgress[userId] = 0;
                }
                timer.participantsCoinsProgress[userId] += delta * rate;

                if (timer.participantsCoinsProgress[userId] >= 60) {
                    const coinsToAward = Math.floor(timer.participantsCoinsProgress[userId] / 60);
                    timer.participantsCoinsProgress[userId] %= 60;
                    db.addCoins(userId, username, coinsToAward, true).catch(err =>
                        console.error('Error awarding coins:', err.message)
                    );
                }

                studyBatch[userId] = { username, seconds: delta };
            });

            if (Object.keys(studyBatch).length > 0) {
                db.batchAddStudyTime(studyBatch).catch(err =>
                    console.error('Error saving study time:', err.message)
                );
            }
        }

        if (timer.timeLeft <= 0) {
            timer.status = 'finished';
            db.updateTimerStatus(channelId, 'finished').catch(err => console.error(`❌ DB error:`, err.message));
        }
    }

    initHeartbeat(client) {
        if (this.heartbeatInterval) return;
        
        this.heartbeatInterval = setInterval(async () => {
            const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            for (const [channelId, timer] of this.activeTimers.entries()) {
                if (timer.status !== 'running') continue;

                // 1. Tick
                const voiceChannel = client.channels.cache.get(channelId);
                await this.tick(channelId, voiceChannel);

                // 2. Handle Phase Transitions
                if (timer.status === 'finished') {
                    const textChannel = client.channels.cache.get(timer.textChannelId);
                    
                    if (timer.mode === 'study') {
                        // Switch to break
                        timer.mode = 'break';
                        timer.totalTime = timer.breakTime;
                        timer.timeLeft = timer.breakTime;
                        timer.status = 'running';
                        await this.updateCycleInDb(channelId, timer.currentCycle, 'break');
                        await this.lockChannel(client, timer, false); // Unlock during break

                        // Challenge Summary Reporting
                        if (timer.isChallenge) {
                            await this.updateChallengeSummary(client, timer, { 
                                cycle: timer.currentCycle, 
                                cycleLeaders: Object.entries(timer.participants || {})
                                    .map(([userId, seconds]) => ({ userId, seconds }))
                                    .sort((a, b) => b.seconds - a.seconds)
                                    .slice(0, 3) 
                            }, false);
                        }

                        if (textChannel) {
                            const mentions = voiceChannel?.members.filter(m => !m.user.bot).map(m => `<@${m.id}>`).join(' ') || '@everyone';
                            await textChannel.send({ 
                                content: `🔔 وقت البريك للجميع!\n${mentions}\n\nانتهى وقت المذاكرة! حان وقت الراحة الآن لمدة **${Math.floor(timer.breakTime / 60)} دقائق**. استمتع ببريكك! ☕` 
                            }).catch(() => {});
                        }
                    } else if (timer.mode === 'break') {
                        if (timer.currentCycle < timer.totalCycles) {
                            timer.currentCycle++;
                            timer.mode = 'study';
                            timer.totalTime = timer.studyTime;
                            timer.timeLeft = timer.studyTime;
                            timer.status = 'running';
                            await this.updateCycleInDb(channelId, timer.currentCycle, 'study');
                            if (timer.isChallenge) await this.lockChannel(client, timer, true); // Relock for study (Challenges only)

                            if (textChannel) {
                                const nextCycleEmbed = new EmbedBuilder()
                                    .setTitle('📚 العودة للمذاكرة!')
                                    .setDescription(`انتهى البريك! لنبدأ الدورة رقم **${timer.currentCycle}** من المذاكرة. اترك الجوال وركز! 💪`)
                                    .setColor('#E67E22')
                                    .setTimestamp();
                                await textChannel.send({ embeds: [nextCycleEmbed] }).catch(() => {});
                            }
                        } else {
                            await this.handleTimerComplete(client, channelId, timer);
                        }
                    }
                }

                // 3. Visual Refresh every 10s
                if (timer.status === 'running') {
                    await this.refreshTimerMessage(client, channelId).catch(() => {});
                }
            }
        }, 10000);
    }

    async refreshTimerMessage(client, channelId) {
        const timer = this.activeTimers.get(channelId);
        if (!timer || !timer.textChannelId) return;

        const textChannel = client.channels.cache.get(timer.textChannelId);
        if (!textChannel) return;

        const { drawTimer } = require('./timerCanvas');
        const themeDb = require('./themesDb');
        const theme = await themeDb.getTheme(timer.themeKey) || {};
        const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const buffer = await drawTimer(timer, theme);
        const attachment = new AttachmentBuilder(buffer, { name: 'timer.png' });

        const embed = new EmbedBuilder()
            .setTitle(timer.isChallenge ? '⏳ تحدي المذاكرة نشط' : '⏳ جلسة المذاكرة النشطة')
            .setColor('#673ab7')
            .setImage('attachment://timer.png')
            .addFields(
                { name: '👤 المنظم', value: `\`${timer.starterName}\``, inline: true },
                { name: '🔄 الجولة', value: `\`${timer.currentCycle}/${timer.totalCycles}\``, inline: true },
                { name: '⏱️ المرحلة', value: `\`${timer.mode === 'study' ? '📖 مذاكرة' : '☕ بريك'}\``, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`timer_stop_${channelId}`).setLabel('إيقاف').setStyle(ButtonStyle.Danger)
        );

        try {
            if (timer.messageId) {
                const msg = await textChannel.messages.fetch(timer.messageId).catch(() => null);
                if (msg) {
                    await msg.edit({ embeds: [embed], files: [attachment], components: [row] });
                    return;
                }
            }
            const newMsg = await textChannel.send({ embeds: [embed], files: [attachment], components: [row] });
            timer.messageId = newMsg.id;
            await db.saveTimer(timer);
        } catch (e) {
            console.error('Refresh failed:', e.message);
        }
    }

    async handleTimerComplete(client, channelId, timer) {
        const { drawLeaderboard } = require('./timerCanvas');
        const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
        const textChannel = client.channels.cache.get(timer.textChannelId);
        const guild = client.guilds.cache.get(timer.guildId);

        await this.lockChannel(client, timer, false); // Unlock channel at end
        this.stopTimer(channelId);

        if (!textChannel || !guild) return;

        // Rewards Distribution logic
        let rewardMessage = '';
        const sorted = Object.entries(timer.participants || {})
            .map(([userId, seconds]) => ({ userId, seconds }))
            .sort((a, b) => b.seconds - a.seconds);

        const top3 = sorted.slice(0, 3);
        const top10 = sorted.slice(3, 13);
        const allWinners = [...top3, ...top10];

        if (timer.isChallenge) {
            if (timer.top3_prize && top3.length > 0) {
                const prize = await this.distributePrize(guild, top3, timer.top3_prize);
                rewardMessage += `🏆 **مبروك للتوب 3 لحصولكم علي جائزه (${prize})!**\n${top3.map(u => `<@${u.userId}>`).join(' ')}\n\n`;
            }

            if (timer.top10_prize && top10.length > 0) {
                const prize = await this.distributePrize(guild, top10, timer.top10_prize);
                rewardMessage += `🎖️ **مبروك للتوب 10 لحصولكم علي جائزه (${prize})!**\n${top10.map(u => `<@${u.userId}>`).join(' ')}\n\n`;
            }
        }

        // Leaderboard Image
        const topUsers = this.getGuildTopStudy(timer.guildId, 20);
        const themeDb = require('./themesDb');
        const theme = await themeDb.getTheme(timer.themeKey) || {};
        const buffer = await drawLeaderboard(topUsers, guild.members.cache, timer.guildId, timer.starterId, theme);
        const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

        if (timer.isChallenge) {
            // ... prizes calculated above ...
            // Challenge Summary (Final Update with visual style identical to timer chat)
            const voiceName = client.channels.cache.get(channelId)?.name || 'الروم الصوتي';
            await this.updateChallengeSummary(client, timer, { 
                cycle: timer.totalCycles, 
                winners: allWinners, 
                voiceName,
                attachment, // Pass attachment to summary
                rewardLabel: rewardMessage.trim() 
            }, true);
        }

        const embed = new EmbedBuilder()
            .setTitle('🏁 تم الإنجاز - النتائج النهائية!')
            .setDescription(`🎉 مبروك! تم الانتهاء من جميع الدورات (**${timer.totalCycles} دورة**). فخورين بهذا الإنجاز!\n\n${rewardMessage}`)
            .setColor('#2ECC71')
            .setImage('attachment://leaderboard.png')
            .setTimestamp();

        await textChannel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
    }

    async updateChallengeSummary(client, timer, cycleDoneInfo = null, final = false) {
        const CHALLENGE_SUMMARY_CHANNEL = '1489993576824705074';
        const channel = client.channels.cache.get(CHALLENGE_SUMMARY_CHANNEL) || await client.channels.fetch(CHALLENGE_SUMMARY_CHANNEL).catch(() => null);
        if (!channel) return;

        const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
        const participantsCount = Object.keys(timer.participants || {}).length;

        if (final) {
            // EXACTLY LIKE TIMER CHAT STYLE
            const embed = new EmbedBuilder()
                .setTitle('🏁 تم الإنجاز - النتائج النهائية!')
                .setDescription(`🎉 مبروك! تم الانتهاء من جميع الدورات (**${timer.totalCycles} دورة**). فخورين بهذا الإنجاز!`)
                .setColor('#2ECC71')
                .setImage('attachment://leaderboard.png')
                .setTimestamp();

            const content = `👑 **النتائج النهائية للتحدي في (${cycleDoneInfo?.voiceName || 'الروم الصوتي'})**\n\n` +
                          `${cycleDoneInfo?.rewardLabel || 'تم الانتهاء من التحدي بنجاح!'}\n\n` +
                          `بالتوفيق ديما ومستنينكو في تحدي جديد 🚀\n\n` +
                          `-# Galaxy server`;

            try {
                // If we have an existing summary message, we update it OR send a fresh one for the final result
                // Usually better to send a fresh one for final results so it stays in history
                await channel.send({ content, embeds: [embed], files: [cycleDoneInfo.attachment] }).catch(() => null);
                return;
            } catch (e) {
                console.error('Final summary failed:', e.message);
                return;
            }
        }

        const overallTop3 = Object.entries(timer.participants || {})
            .map(([userId, seconds]) => ({ userId, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 3);

        const embed = new EmbedBuilder()
            .setTitle(`📣 تقرير تحدي غرفة <#${timer.channelId}>`)
            .setDescription(`**المشاركون:** \`${participantsCount}\` مشارك\n**الحالة:** 🔄 جولة ${timer.currentCycle}/${timer.totalCycles}`)
            .setColor('#9B59B6')
            .addFields(
                { name: '🥇 الأوائل في هذه الدورة', value: this.formatMentions(cycleDoneInfo?.cycleLeaders) || '*لا يوجد بيانات*', inline: false },
                { name: '🏆 الترتيب العام الحالي (Top 3)', value: this.formatMentions(overallTop3) || '*لا يوجد بيانات*', inline: false }
            )
            .setTimestamp();

        try {
            if (timer.challengeSummaryMessageId) {
                const msg = await channel.messages.fetch(timer.challengeSummaryMessageId).catch(() => null);
                if (msg) return await msg.edit({ embeds: [embed] }).catch(() => null);
            }
            const newMsg = await channel.send({ embeds: [embed] }).catch(() => null);
            if (newMsg) {
                timer.challengeSummaryMessageId = newMsg.id;
                db.saveTimer(timer).catch(() => {});
            }
        } catch (e) {
            console.error('Summary update failed:', e.message);
        }
    }

    formatMentions(rank) {
        if (!rank || rank.length === 0) return '*لا يوجد مشاركين حتى الآن*';
        return rank.map((item, idx) => `**${idx + 1}.** <@${item.userId}> - \`${Math.floor(item.seconds / 60)}m ${item.seconds % 60}s\``).join('\n');
    }

    async distributePrize(guild, participants, prizeInput) {
        const amount = parseInt(prizeInput);
        if (!isNaN(amount)) {
            for (const p of participants) {
                const member = guild.members.cache.get(p.userId) || await guild.members.fetch(p.userId).catch(() => null);
                if (member) await db.addCoins(p.userId, member.displayName, amount, true);
            }
            return `${amount} كوينز 💰`;
        } else {
            const roleId = prizeInput.replace(/[<@&>]/g, '');
            const role = guild.roles.cache.get(roleId) || guild.roles.cache.find(r => r.name === prizeInput);
            if (role) {
                for (const p of participants) {
                    const member = guild.members.cache.get(p.userId) || await guild.members.fetch(p.userId).catch(() => null);
                    if (member) await member.roles.add(role).catch(() => {});
                }
                return `رتبة **${role.name}** 🛡️`;
            }
        }
        return prizeInput;
    }

    async updateCycleInDb(channelId, newCycle, newMode) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;
        timer.currentCycle = newCycle;
        timer.mode = newMode;
        await db.updateTimerCycle(channelId, newCycle, newMode).catch(() => {});
    }

    async restoreTimersFromDb() {
        try {
            const savedTimers = await db.getRunningTimers();
            for (const saved of savedTimers) {
                const elapsed = Math.floor((Date.now() - saved.start_time) / 1000);
                let duration = saved.mode === 'study' ? saved.study_time : saved.break_time;
                const timeLeft = Math.max(0, duration - elapsed);

                this.activeTimers.set(saved.channel_id, {
                    guildId: saved.guild_id,
                    channelId: saved.channel_id,
                    textChannelId: saved.text_channel_id,
                    starterId: saved.starter_id,
                    starterName: saved.starter_name,
                    studyTime: saved.study_time,
                    breakTime: saved.break_time,
                    totalTime: duration,
                    timeLeft: timeLeft,
                    mode: saved.mode,
                    updateMode: saved.update_mode,
                    currentCycle: saved.current_cycle,
                    totalCycles: saved.cycles,
                    themeKey: saved.theme_key,
                    top3_prize: saved.top3_prize,
                    top10_prize: saved.top10_prize,
                    startTime: saved.start_time,
                    status: saved.paused_time ? 'paused' : 'running',
                    isChallenge: (saved.top3_prize || saved.top10_prize) ? true : false,
                    isLocked: false, // Reset lock state on restore
                    participants: {},
                    participantNames: {},
                    participantAvatars: {},
                    participantsCoinsProgress: {},
                    currentParticipants: new Set(),
                    lastUpdate: Date.now()
                });
            }
            console.log(`✅ Restored ${savedTimers.length} timers`);
        } catch (e) {
            console.error('Restore failed:', e.message);
        }
    }
}

module.exports = new TimerManager();
