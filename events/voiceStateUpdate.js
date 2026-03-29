const timerManager = require('../utils/timerManager');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // --- Logic: Detect Participation Changes ---
        
        // 1. User joins or switches to a channel
        if (newState.channelId) {
            const timer = timerManager.getTimer(newState.channelId);
            if (timer) {
                timerManager.addParticipant(newState.channelId, newState.id);
                // Cache user info for display
                if (newState.member) {
                    if (!timer.participantNames[newState.id]) {
                        timer.participantNames[newState.id] = newState.member.displayName || newState.member.user.username;
                    }
                    if (!timer.participantAvatars[newState.id]) {
                        timer.participantAvatars[newState.id] = newState.member.user.displayAvatarURL({ extension: 'png', size: 128 });
                    }
                }
                // --- Instant Update ---
                timerManager.triggerRefresh(newState.channelId).catch(() => {});
            }
        }

        // 2. User leaves or switches from a channel
        if (oldState.channelId) {
            const timer = timerManager.getTimer(oldState.channelId);
            if (timer) {
                // Check if they are actually leaving the room with the timer
                if (newState.channelId !== oldState.channelId) {
                    timerManager.removeParticipant(oldState.channelId, oldState.id);
                    
                    // --- AUTO-STOP: Check if VC is now empty ---
                    const channel = oldState.guild.channels.cache.get(oldState.channelId);
                    const humanMembers = channel?.members.filter(m => !m.user.bot);
                    
                    if (!humanMembers || humanMembers.size === 0) {
                        try {
                            // Cleanup Interval
                            if (timer.intervalId) clearInterval(timer.intervalId);
                            
                            // Cleanup Message
                            if (timer.messageId) {
                                const channelObj = oldState.guild.channels.cache.get(timer.channelId);
                                if (channelObj && channelObj.isTextBased()) {
                                    const msg = await channelObj.messages.fetch(timer.messageId).catch(() => null);
                                    if (msg) await msg.delete().catch(() => {});
                                }
                            }
                        } catch (e) {}

                        timerManager.stopTimer(oldState.channelId);
                        
                        // Notify (Optional but helpful)
                        const textChannel = oldState.guild.channels.cache.find(c => c.isTextBased() && c.id === oldState.channelId) || oldState.channel;
                        if (textChannel && typeof textChannel.send === 'function') {
                            await textChannel.send(`⚠️ تم إيقاف التايمر في <#${oldState.channelId}> تلقائياً لأن الغرفة أصبحت فارغة.`);
                        }
                    } else {
                        // Just a normal leave, refresh UI
                        timerManager.triggerRefresh(oldState.channelId).catch(() => {});
                    }
                }
            }
        }
    },
};
