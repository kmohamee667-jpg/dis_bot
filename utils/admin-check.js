const { PERMISSIONS } = require('./config');

/**
 * Checks if the user has permission to use a specific admin command.
 * 
 * Checks:
 *   1. Is the username in the command's `users` list?
 *   2. Does the user have any of the command's `roles`?
 *      - Supports BOTH Role Names (e.g. 'معلم') AND Role IDs (e.g. '123456789')
 * 
 * @param {import('discord.js').Interaction | import('discord.js').Message} context
 * @param {string} commandName - The key from PERMISSIONS in config.js
 * @returns {boolean}
 */
function isAdmin(context, commandName) {
    const perms = PERMISSIONS[commandName];

    // If no permissions entry exists for this command, deny by default
    if (!perms) return false;

    const user = context.user || context.author; // Interaction uses .user, Message uses .author
    const member = context.member;

    // 1. Check if the username is whitelisted for this command
    if (perms.users && perms.users.includes(user.username)) {
        return true;
    }

    // 2. Check if the user has any of the allowed roles (by Role Name OR Role ID)
    if (perms.roles && perms.roles.length > 0 && member && member.roles) {
        const roleList = perms.roles.map(r => r.toLowerCase());

        // Handle GuildMemberRoleManager (cached roles - most common in discord.js v14)
        if (member.roles.cache) {
            const hasRole = member.roles.cache.some(role =>
                roleList.includes(role.name.toLowerCase()) || roleList.includes(role.id)
            );
            if (hasRole) return true;
        }

        // Handle raw API Member (roles as array of IDs)
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
