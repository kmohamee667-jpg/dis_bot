const { getSupabase, safeQuery } = require('./supabase');

async function getUser(userId) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('galaxy_users')
            .select('*')
            .eq('discord_id', userId)
            .single();
        if (error && error.code === 'PGRST116') return null;
        if (error) throw error;
        return data;
    });
}

async function createUser(userId, username, initialCoins = 0) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('galaxy_users')
            .upsert({
                discord_id: userId,
                username,
                coins: initialCoins,
                last_added: initialCoins > 0 ? new Date().toISOString() : null,
                daily_last_claimed: null,
                study_seconds: 0
            }, { onConflict: 'discord_id', ignoreDuplicates: false })
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

async function updateUserCoins(userId, username, newCoins, updateLastAdded = false) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data: existing } = await supabase
            .from('galaxy_users')
            .select('coins')
            .eq('discord_id', userId)
            .single();

        const updateData = { discord_id: userId, username, coins: newCoins };
        if (updateLastAdded && (!existing || newCoins > (existing.coins || 0))) {
            updateData.last_added = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('galaxy_users')
            .upsert(updateData, { onConflict: 'discord_id', ignoreDuplicates: false })
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

async function addCoins(userId, username, amount, updateLastAdded = false) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase.rpc('add_user_coins', {
            p_discord_id: userId,
            p_username: username,
            p_amount: amount,
            p_update_last_added: updateLastAdded
        });
        if (error) throw error;
    });
}

async function setLastClaimed(userId) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('galaxy_users')
            .update({ daily_last_claimed: new Date().toISOString() })
            .eq('discord_id', userId);
        if (error) throw error;
    });
}

async function batchAddStudyTime(participantsMap) {
    const supabase = await getSupabase();
    await Promise.all(
        Object.entries(participantsMap).map(([userId, { username, seconds }]) =>
            safeQuery(async () => {
                const { error } = await supabase.rpc('add_study_seconds', {
                    p_discord_id: userId,
                    p_username: username,
                    p_seconds: seconds
                });
                if (error) throw error;
            })
        )
    );
}

// ============================================================
// Timer Persistence Functions
// ============================================================

async function saveTimer(timerData) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('timer')
            .upsert({
                channel_id: timerData.channelId,
                text_channel_id: timerData.textChannelId,
                guild_id: timerData.guildId,
                starter_id: timerData.starterId,
                starter_name: timerData.starterName,
                study_time: timerData.studyTime,
                break_time: timerData.breakTime,
                cycles: timerData.totalCycles,
                current_cycle: timerData.currentCycle,
                theme_key: timerData.themeKey,
                mode: timerData.mode,
                update_mode: timerData.updateMode,
                top3_prize: timerData.top3_prize || null,
                top10_prize: timerData.top10_prize || null,
                start_time: timerData.startTime,
                paused_time: timerData.pausedTime || null,
                status: timerData.status,
                updated_at: new Date().toISOString()
            }, { onConflict: 'channel_id', ignoreDuplicates: false })
            .select()
            .single();
        if (error) throw error;
        return data;
    });
}

async function getRunningTimers() {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('timer')
            .select('*')
            .eq('status', 'running');
        if (error) throw error;
        return data || [];
    });
}

async function getTimer(channelId) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('timer')
            .select('*')
            .eq('channel_id', channelId)
            .single();
        if (error && error.code === 'PGRST116') return null;
        if (error) throw error;
        return data;
    });
}

async function updateTimerStatus(channelId, status, pausedTime = null) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const updateData = {
            status: status,
            updated_at: new Date().toISOString()
        };
        if (pausedTime !== null) {
            updateData.paused_time = pausedTime;
        }
        const { error } = await supabase
            .from('timer')
            .update(updateData)
            .eq('channel_id', channelId);
        if (error) throw error;
    });
}

async function updateTimerCycle(channelId, newCycle, newMode) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { error } = await supabase
            .from('timer')
            .update({
                current_cycle: newCycle,
                mode: newMode,
                updated_at: new Date().toISOString()
            })
            .eq('channel_id', channelId);
        if (error) throw error;
    });
}

async function deleteTimer(channelId) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { error } = await supabase
            .from('timer')
            .delete()
            .eq('channel_id', channelId);
        if (error) throw error;
    });
}

async function getStudyTime(userId) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('galaxy_users')
            .select('study_seconds')
            .eq('discord_id', userId)
            .single();
        if (error) return 0;
        return data?.study_seconds || 0;
    });
}

async function resetAllCoins() {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('galaxy_users')
            .update({ coins: 0 })
            .gte('coins', 0);
        if (error) throw error;
    });
}

async function resetUserCoins(userId) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('galaxy_users')
            .update({ coins: 0 })
            .eq('discord_id', userId);
        if (error) throw error;
    });
}

module.exports = {
    getUser,
    createUser,
    updateUserCoins,
    addCoins,
    setLastClaimed,
    batchAddStudyTime,
    saveTimer,
    getRunningTimers,
    getTimer,
    updateTimerStatus,
    updateTimerCycle,
    deleteTimer,
    getStudyTime,
    resetAllCoins,
    resetUserCoins
};
