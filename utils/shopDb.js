const { getSupabase, safeQuery } = require('./supabase');

async function getRoles() {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('shop_roles')
            .select('*')
            .order('role_name');
        if (error) throw error;
        return data.map(r => ({ id: r.role_id, name: r.role_name, price: r.price }));
    }) || [];
}

async function getRole(roleId) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('shop_roles')
            .select('*')
            .eq('role_id', roleId)
            .single();
        if (error && error.code === 'PGRST116') return null;
        if (error) throw error;
        return { id: data.role_id, name: data.role_name, price: data.price };
    });
}

async function addRole(roleId, roleName, price) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { error } = await supabase
            .from('shop_roles')
            .insert({ role_id: roleId, role_name: roleName, price });
        if (error) {
            if (error.code === '23505') return false;
            throw error;
        }
        return true;
    });
}

async function deleteRole(roleId) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const { error } = await supabase
            .from('shop_roles')
            .delete()
            .eq('role_id', roleId);
        if (error) throw error;
    });
    return true;
}

async function updateRolePrice(roleId, newPrice) {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('shop_roles')
            .update({ price: newPrice })
            .eq('role_id', roleId)
            .select();
        if (error) throw error;
        return data && data.length > 0;
    });
}

async function getMetadata() {
    const supabase = await getSupabase();
    return await safeQuery(async () => {
        const { data, error } = await supabase
            .from('shop_metadata')
            .select('*');
        if (error) throw error;
        const result = {};
        for (const row of data) result[row.key] = row.value;
        return result;
    }) || {};
}

async function updateMetadata(metadata) {
    const supabase = await getSupabase();
    await safeQuery(async () => {
        const rows = Object.entries(metadata).map(([key, value]) => ({ key, value }));
        const { error } = await supabase
            .from('shop_metadata')
            .upsert(rows, { onConflict: 'key' });
        if (error) throw error;
    });
}

module.exports = { getRoles, addRole, deleteRole, getRole, getMetadata, updateMetadata, updateRolePrice };
