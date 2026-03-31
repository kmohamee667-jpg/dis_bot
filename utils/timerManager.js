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
        }
    }
}

module.exports = new TimerManager();
