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
            const { eventType, new: newRecord, old: oldRecord } = payload;
            
            console.log(`\n🔔 [DB CHANGE DETECTED] Event: ${eventType}`);
            
            if (eventType === 'INSERT') {
                console.log(`   ➕ ADDED: ${newRecord.command_name} -> ${newRecord.type}: ${newRecord.value}`);
            } else if (eventType === 'DELETE') {
                console.log(`   ➖ REMOVED: ${oldRecord.command_name ? oldRecord.command_name : 'Record'} (ID: ${oldRecord.id})`);
            } else if (eventType === 'UPDATE') {
                console.log(`   📝 UPDATED: ${newRecord.command_name} -> ${newRecord.type}: ${newRecord.value}`);
            }

            console.log('   🔄 Refreshing permissions cache...');
            loadPermissions();
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('🔌 Realtime Sync: Listening for command_permissions changes...');
            }
        });
}

/**
 * Checks permission DIRECTLY in Supabase (Live check).
 */
async function checkPermissionLive(commandName, userId, username, roles, roleIds) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('command_permissions')
        .select('*')
        .eq('command_name', commandName);

    if (error || !data) return false;

    const lowerRoles = (roles || []).map(r => r.toLowerCase());
    const finalRoleIds = roleIds || [];

    return data.some(p => {
        if (p.type === 'user') return p.value === userId || p.value === username;
        if (p.type === 'role') return lowerRoles.includes(p.value.toLowerCase()) || finalRoleIds.includes(p.value);
        return false;
    });
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

module.exports = { loadPermissions, subscribeToPermissions, checkPermissionLive, getPermissionsSync, addPermission, removePermission };
