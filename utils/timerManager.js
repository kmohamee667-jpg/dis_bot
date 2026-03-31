const db = require('./db');

class TimerManager {
    constructor() {
        this.activeTimers = new Map();
        this.guildStudyTotals = new Map();
    }

    startTimer(channelId, data) {
        data.startTime = Date.now();
        data.participants = data.participants || {};
        data.participantNames = data.participantNames || {};
        data.participantAvatars = data.participantAvatars || {};
        data.participantsCoinsProgress = data.participantsCoinsProgress || {};
        data.currentParticipants = data.currentParticipants || new Set();
        data.lastUpdate = Date.now();
        data.status = 'running';
        data.starterName = data.starterName || 'System';
        data.refreshCallback = data.refreshCallback || null;
        this.activeTimers.set(channelId, data);

        // ✅ حفظ التايمر في قاعدة البيانات
        db.saveTimer(data).catch(err =>
            console.error(`❌ Error saving timer for channel ${channelId}:`, err.message)
        );
    }

    async triggerRefresh(channelId) {
        const timer = this.activeTimers.get(channelId);
        if (timer && typeof timer.refreshCallback === 'function') {
            await timer.refreshCallback();
        }
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

    stopTimer(channelId) {
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
            timer.participants[userId] = 0;
        }
    }

    removeParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.delete(userId);
            if (timer.participants[userId] !== undefined) {
                delete timer.participants[userId];
            }
        }
    }

    async tick(channelId, voiceChannel = null) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        const now = Date.now();
        const delta = Math.floor((now - timer.lastUpdate) / 1000);
        const effectiveDelta = delta > 0 ? delta : (now - timer.lastUpdate >= 800 ? 1 : 0);
        if (effectiveDelta <= 0) return;

        timer.timeLeft = Math.max(0, timer.timeLeft - effectiveDelta);
        timer.lastUpdate = now;

        if (timer.mode === 'study' && timer.timeLeft > 0) {
            const studyBatch = {};

            timer.currentParticipants.forEach(userId => {
                const username = timer.participantNames[userId] || 'User';

                if (!timer.participants[userId]) timer.participants[userId] = 0;
                timer.participants[userId] += effectiveDelta;

                if (timer.guildId) {
                    if (!this.guildStudyTotals.has(timer.guildId)) {
                        this.guildStudyTotals.set(timer.guildId, {});
                    }
                    const guildMap = this.guildStudyTotals.get(timer.guildId);
                    guildMap[userId] = (guildMap[userId] || 0) + effectiveDelta;
                }

                let rate = 1;
                if (voiceChannel) {
                    const member = voiceChannel.members.get(userId);
                    if (member?.voice?.streaming || member?.voice?.selfVideo) rate = 2;
                }

                if (typeof timer.participantsCoinsProgress[userId] !== 'number') {
                    timer.participantsCoinsProgress[userId] = 0;
                }
                timer.participantsCoinsProgress[userId] += effectiveDelta * rate;

                if (timer.participantsCoinsProgress[userId] >= 60) {
                    const coinsToAward = Math.floor(timer.participantsCoinsProgress[userId] / 60);
                    timer.participantsCoinsProgress[userId] %= 60;
                    db.addCoins(userId, username, coinsToAward, true).catch(err =>
                        console.error('Error awarding coins:', err.message)
                    );
                }

                studyBatch[userId] = { username, seconds: effectiveDelta };
            });

            if (Object.keys(studyBatch).length > 0) {
                db.batchAddStudyTime(studyBatch).catch(err =>
                    console.error('Error saving study time:', err.message)
                );
            }
        }

        if (timer.timeLeft <= 0) {
            timer.status = 'finished';
            
            // ✅ تحديث حالة التايمر في قاعدة البيانات
            db.updateTimerStatus(channelId, 'finished').catch(err =>
                console.error(`❌ Error updating timer status:`, err.message)
            );
        }
    }

    async pauseTimer(channelId) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        timer.status = 'paused';
        timer.pausedTime = Date.now();

        // ✅ تحديث حالة التايمر في قاعدة البيانات
        await db.updateTimerStatus(channelId, 'paused', timer.pausedTime).catch(err =>
            console.error(`❌ Error pausing timer:`, err.message)
        );
    }

    async resumeTimer(channelId) {
        const timer = this.activeTimers.get(channelId);
        if (!timer || !timer.pausedTime) return;

        // حساب المدة المتوقفة
        const pausedDuration = Date.now() - timer.pausedTime;
        timer.startTime += pausedDuration;
        timer.pausedTime = null;
        timer.status = 'running';
        timer.lastUpdate = Date.now();

        // ✅ تحديث التايمر في قاعدة البيانات
        await db.saveTimer(timer).catch(err =>
            console.error(`❌ Error resuming timer:`, err.message)
        );
    }

    async updateCycleInDb(channelId, newCycle, newMode) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        timer.currentCycle = newCycle;
        timer.mode = newMode;

        // ✅ تحديث الدورة في قاعدة البيانات
        await db.updateTimerCycle(channelId, newCycle, newMode).catch(err =>
            console.error(`❌ Error updating cycle:`, err.message)
        );
    }

    // 🔄 استعادة التايمرات من قاعدة البيانات عند تشغيل البوت
    async restoreTimersFromDb() {
        try {
            const savedTimers = await db.getRunningTimers();
            console.log(`📊 Found ${savedTimers.length} running timers in database`);

            for (const savedTimer of savedTimers) {
                try {
                    // حساب الوقت المنقضي
                    const elapsed = Math.floor((Date.now() - savedTimer.start_time) / 1000);
                    
                    // حساب الوقت المتبقي بناءً على mode
                    let totalDuration = savedTimer.mode === 'study' 
                        ? savedTimer.study_time 
                        : savedTimer.break_time;
                    
                    const timeLeft = Math.max(0, totalDuration - elapsed);

                    const restoredTimer = {
                        guildId: savedTimer.guild_id,
                        channelId: savedTimer.channel_id,
                        starterId: savedTimer.starter_id,
                        starterName: savedTimer.starter_name,
                        studyTime: savedTimer.study_time,
                        breakTime: savedTimer.break_time,
                        totalTime: savedTimer.mode === 'study' 
                            ? savedTimer.study_time 
                            : savedTimer.break_time,
                        timeLeft: timeLeft,
                        mode: savedTimer.mode,
                        updateMode: savedTimer.update_mode,
                        currentCycle: savedTimer.current_cycle,
                        totalCycles: savedTimer.cycles,
                        themeKey: savedTimer.theme_key,
                        startTime: savedTimer.start_time,
                        pausedTime: savedTimer.paused_time,
                        status: savedTimer.paused_time ? 'paused' : 'running',
                        
                        // تهيئة الخصائص المطلوبة
                        participants: {},
                        participantNames: {},
                        participantAvatars: {},
                        participantsCoinsProgress: {},
                        currentParticipants: new Set(),
                        lastUpdate: Date.now(),
                        refreshCallback: null
                    };

                    // إضافة التايمر إلى activeTimers
                    this.activeTimers.set(savedTimer.channel_id, restoredTimer);
                    console.log(`✅ Restored timer in channel ${savedTimer.channel_id} (${timeLeft}s remaining)`);
                } catch (err) {
                    console.error(`❌ Error restoring timer for channel ${savedTimer.channel_id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('❌ Error restoring timers from database:', err.message);
        }
    }
}

module.exports = new TimerManager();
