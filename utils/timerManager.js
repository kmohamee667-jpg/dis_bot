const fs = require('fs');
const path = require('path');

class TimerManager {
    constructor() {
        this.activeTimers = new Map(); // Key: voiceChannelId
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
     * Update participant times
     */
    tick(channelId) {
        const timer = this.activeTimers.get(channelId);
        if (!timer) return;

        const now = Date.now();
        const delta = Math.floor((now - timer.lastUpdate) / 1000);
        
        if (delta <= 0) return;

        // Update time left
        timer.timeLeft -= delta;
        timer.lastUpdate = now;

        // --- COMPETITIVE FIX: Only count study time ---
        if (timer.mode === 'study') {
            timer.currentParticipants.forEach(userId => {
                if (!timer.participants[userId]) timer.participants[userId] = 0;
                timer.participants[userId] += delta;
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
