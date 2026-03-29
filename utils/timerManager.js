const fs = require('fs');
const path = require('path');
const db = require('./db');

class TimerManager {
    constructor() {
        this.activeTimers = new Map(); // Key: voiceChannelId
        this.guildStudyTotals = new Map(); // Key: guildId -> { userId: totalSeconds }
    }

    /**
     * Start a new timer
     */
    startTimer(channelId, data) {
        // We store the object itself to allow live updates to properties like intervalId
        data.startTime = Date.now();
        data.participants = data.participants || {};
        data.participantNames = data.participantNames || {};
        data.participantAvatars = data.participantAvatars || {};
        data.participantsCoinsProgress = data.participantsCoinsProgress || {}; // Tracks progress towards 1 coin (60 units)
        data.currentParticipants = data.currentParticipants || new Set();
        data.lastUpdate = Date.now();
        data.status = 'running';
        data.starterName = data.starterName || 'System';
        data.refreshCallback = data.refreshCallback || null;
        
        this.activeTimers.set(channelId, data);
    }

    /**
     * Trigger a UI refresh if a callback is registered
     */
    async triggerRefresh(channelId) {
        const timer = this.activeTimers.get(channelId);
        if (timer && typeof timer.refreshCallback === 'function') {
            await timer.refreshCallback();
        }
    }

    /**
     * Get timer by channel ID
     */
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

    getUserStudyTime(guildId, userId) {
        const guildMap = this.guildStudyTotals.get(guildId) || {};
        return guildMap[userId] || 0;
    }

    /**
     * Stop and remove a timer
     */
    stopTimer(channelId) {
        this.activeTimers.delete(channelId);
    }

    /**
     * Check if a timer exists in a guild/channel
     */
    hasTimer(channelId) {
        return this.activeTimers.has(channelId);
    }

    /**
     * Update participant times and award coins
     */
    tick(channelId, voiceChannel = null) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        const now = Date.now();
        const delta = Math.floor((now - timer.lastUpdate) / 1000);
        
        if (delta <= 0) return;

        // Update time left
        timer.timeLeft -= delta;
        timer.lastUpdate = now;

        // --- 🪙 ECONOMY INTEGRATION: Award coins ---
        if (timer.mode === 'study') {
            timer.currentParticipants.forEach(userId => {
                // 1. Update Participation Time (for image)
                if (!timer.participants[userId]) timer.participants[userId] = 0;
                timer.participants[userId] += delta;

                    // 1.b Update guild totals for top-time command
                    if (timer.guildId) {
                        if (!this.guildStudyTotals.has(timer.guildId)) this.guildStudyTotals.set(timer.guildId, {});
                        const guildMap = this.guildStudyTotals.get(timer.guildId);
                        if (!guildMap[userId]) guildMap[userId] = 0;
                        guildMap[userId] += delta;
                    }

                if (voiceChannel) {
                    const member = voiceChannel.members.get(userId);
                    if (member && member.voice) {
                        // Bonus: 2 coins per minute if streaming or camera on
                        if (member.voice.streaming || member.voice.selfVideo) {
                            rate = 2;
                        }
                    }
                }

                timer.participantsCoinsProgress[userId] += delta * rate;

                // 3. Award Coins (Every 60 units = 1 coin)
                if (timer.participantsCoinsProgress[userId] >= 60) {
                    const coinsToAward = Math.floor(timer.participantsCoinsProgress[userId] / 60);
                    timer.participantsCoinsProgress[userId] %= 60; // Keep the remainder

                    // Update Database
                    const username = timer.participantNames[userId] || 'User';
                    const user = db.getUser(userId) || db.createUser(userId, username, 0);
                    db.updateUserCoins(userId, username, user.coins + coinsToAward, true);
                }
            });
        }
        // ----------------------------------------------

        if (timer.timeLeft <= 0) {
            timer.status = 'finished';
        }
    }

    /**
     * Add participant to tracking
     */
    addParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.add(userId);
            if (!timer.participants[userId]) timer.participants[userId] = 0;
        }
    }

    /**
     * Remove participant from tracking (but keep their data)
     */
    removeParticipant(channelId, userId) {
        const timer = this.activeTimers.get(channelId);
        if (timer) {
            timer.currentParticipants.delete(userId);
        }
    }
}

module.exports = new TimerManager();
