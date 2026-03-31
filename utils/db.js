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
    getStudyTime,
    resetAllCoins,
    resetUserCoins
};
