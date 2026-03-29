const db = require('./db');

class TimerManager {
    constructor() {
        this.activeTimers = new Map(); // Key: voiceChannelId
        this.guildStudyTotals = new Map(); // Key: guildId -> { userId: totalSeconds } (in-memory for top-time)
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

    // Used by /top-time command — reads from in-memory map (session totals)
    getGuildTopStudy(guildId, topN = 5) {
        const guildMap = this.guildStudyTotals.get(guildId) || {};
        return Object.entries(guildMap)
            .map(([userId, seconds]) => ({ userId, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, topN);
    }

    stopTimer(channelId) {
        this.activeTimers.delete(channelId);
    }

    hasTimer(channelId) {
        return this.activeTimers.has(channelId);
    }

    addParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.add(userId);
            // Reset in-session participation timer for this join
            timer.participants[userId] = 0;
        }
    }

    removeParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.delete(userId);
            // Remove from left-side UI list as requested
            if (timer.participants[userId] !== undefined) {
                delete timer.participants[userId];
            }
        }
    }

    /**
     * Advance the timer clock and award coins.
     * Called every 10 seconds by the interval in start.js.
     *
     * Coin rules:
     *   - 1 coin per 60 seconds of study (rate = 1)
     *   - 2 coins per 60 seconds if camera or screen share is on (rate = 2)
     *
     * Study time is persisted to the database every tick so it survives bot restarts.
     */
    tick(channelId, voiceChannel = null) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        const now = Date.now();
        const delta = Math.floor((now - timer.lastUpdate) / 1000);
        const effectiveDelta = delta > 0 ? delta : (now - timer.lastUpdate >= 800 ? 1 : 0);
        if (effectiveDelta <= 0) return;

        // Decrement time, never go below 0
        timer.timeLeft = Math.max(0, timer.timeLeft - effectiveDelta);
        timer.lastUpdate = now;

        // Only award coins and track time during study phase while timer is running
        if (timer.mode === 'study' && timer.timeLeft > 0) {
            const studyBatch = {}; // { userId: { username, seconds } } for one DB write

            timer.currentParticipants.forEach(userId => {
                const username = timer.participantNames[userId] || 'User';

                // Update in-session participation time (for the timer image)
                if (!timer.participants[userId]) timer.participants[userId] = 0;
                timer.participants[userId] += effectiveDelta;

                // Update in-memory guild totals (for /top-time command)
                if (timer.guildId) {
                    if (!this.guildStudyTotals.has(timer.guildId)) {
                        this.guildStudyTotals.set(timer.guildId, {});
                    }
                    const guildMap = this.guildStudyTotals.get(timer.guildId);
                    guildMap[userId] = (guildMap[userId] || 0) + effectiveDelta;
                }

                // Determine coin rate: 2x if camera or screen share is active
                let rate = 1;
                if (voiceChannel) {
                    const member = voiceChannel.members.get(userId);
                    if (member?.voice?.streaming || member?.voice?.selfVideo) {
                        rate = 2;
                    }
                }

                // Accumulate coin progress (60 units = 1 coin)
                if (typeof timer.participantsCoinsProgress[userId] !== 'number') {
                    timer.participantsCoinsProgress[userId] = 0;
                }
                timer.participantsCoinsProgress[userId] += effectiveDelta * rate;

                // Award coins when progress reaches 60
                if (timer.participantsCoinsProgress[userId] >= 60) {
                    const coinsToAward = Math.floor(timer.participantsCoinsProgress[userId] / 60);
                    timer.participantsCoinsProgress[userId] %= 60;

                    const user = db.getUser(userId) || db.createUser(userId, username, 0);
                    db.updateUserCoins(userId, username, user.coins + coinsToAward, true);
                }

                // Batch study time for a single DB write below
                studyBatch[userId] = { username, seconds: effectiveDelta };
            });

            // Persist study time to DB in one atomic write
            if (Object.keys(studyBatch).length > 0) {
                db.batchAddStudyTime(studyBatch);
            }
        }

        if (timer.timeLeft <= 0) {
            timer.status = 'finished';
        }
    }
}

module.exports = new TimerManager();
