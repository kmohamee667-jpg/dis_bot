const { getSupabase, safeQuery } = require('./supabase');

let permissionsCache = {};
let usingFallback = false;

function loadFallback() {
    try {
        const { PERMISSIONS } = require('./config');
        permissionsCache = PERMISSIONS;
        usingFallback = true;
        console.log('⚠️  Supabase permissions unavailable — using local config.js as fallback.');
    } catch (e) {
        console.error('❌ Could not load config.js fallback either:', e.message);
    }
}

async function loadPermissions() {
    let data;
    try {
        const supabase = await getSupabase();
        data = await safeQuery(async () => {
            const { data, error } = await supabase
                .from('command_permissions')
                .select('*');
            if (error) throw error;
            return data;
        });
    } catch (err) {
        console.error('⚠️ Failed to load permissions from Supabase:', err.message);
        console.error('Falling back to local config.js until Supabase is ready.');
        loadFallback();
        return;
    }

    if (!data || data.length === 0) {
        console.warn('⚠️ command_permissions table is empty — falling back to config.js.');
        loadFallback();
        return;
    }

    const newCache = {};
    for (const row of data) {
        if (!newCache[row.command_name]) {
            newCache[row.command_name] = { roles: [], users: [] };
        }
        if (row.type === 'role') newCache[row.command_name].roles.push(row.value);
        if (row.type === 'user') newCache[row.command_name].users.push(row.value);
    }
    permissionsCache = newCache;
    usingFallback = false;
    console.log(`✅ Loaded permissions for ${Object.keys(permissionsCache).length} commands from Supabase.`);
}

function getPermissionsSync(commandName) {
    return permissionsCache[commandName] || null;
}

async function addPermission(commandName, type, value) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('command_permissions')
            .insert({ command_name: commandName, type, value });
        if (error && error.code !== '23505') throw error;
    });
    await loadPermissions();
}

async function removePermission(commandName, type, value) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('command_permissions')
            .delete()
            .eq('command_name', commandName)
            .eq('type', type)
            .eq('value', value);
        if (error) throw error;
    });
    await loadPermissions();
}

module.exports = { loadPermissions, getPermissionsSync, addPermission, removePermission };
