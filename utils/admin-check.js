const { getPermissionsSync } = require('./configDb');

/**
 * Checks if the user has permission to use a specific admin command.
 * Uses cached permissions loaded from Supabase at startup.
 *
 * @param {import('discord.js').Interaction | import('discord.js').Message} context
 * @param {string} commandName
 * @returns {boolean}
 */
function isAdmin(context, commandName) {
    const perms = getPermissionsSync(commandName);
    if (!perms) return false;

    const user = context.user || context.author;
    const member = context.member;

    if (perms.users && perms.users.includes(user.username)) return true;

    if (perms.roles && perms.roles.length > 0 && member && member.roles) {
        const roleList = perms.roles.map(r => r.toLowerCase());

        if (member.roles.cache) {
            const hasRole = member.roles.cache.some(role =>
                roleList.includes(role.name.toLowerCase()) || roleList.includes(role.id)
            );
            if (hasRole) return true;
        }

        if (Array.isArray(member.roles) && context.guild) {
            const hasRole = member.roles.some(roleId => {
                const role = context.guild.roles.cache.get(roleId);
                return role && (roleList.includes(role.name.toLowerCase()) || roleList.includes(role.id));
            });
            if (hasRole) return true;
        }
    }

    return false;
}

module.exports = { isAdmin };
