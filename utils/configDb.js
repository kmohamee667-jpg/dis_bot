const { getSupabase, safeQuery } = require('./supabase');

let permissionsCache = {};
let usingFallback = false;

// DB-ONLY permissions - No fallback to config.js


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
        console.error('❌ Supabase connection failed:', err.message);
        console.error('💡 Run seed-permissions.sql in Supabase dashboard');
        permissionsCache = {};
        return;
    }

    if (!data || data.length === 0) {
        console.error('❌ command_permissions table EMPTY');
        console.error('💡 1. Open seed-permissions.sql');
        console.error('   2. Run in Supabase SQL Editor');
        console.error('   3. Restart bot');
        permissionsCache = {};
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
    console.log(`✅ Loaded ${Object.keys(newCache).length} commands from DB!`);
}

async function subscribeToPermissions() {
    const supabase = await getSupabase();
    supabase
        .channel('public:command_permissions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'command_permissions' }, (payload) => {
            console.log('🔄 Permissions changed in DB (Realtime)! Reloading...');
            loadPermissions();
        })
        .subscribe();
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

module.exports = { loadPermissions, subscribeToPermissions, getPermissionsSync, addPermission, removePermission };
