const { checkPermissionLive, getPermissionsSync } = require('./configDb');

/**
 * Checks if the user has permission to use a specific admin command.
 * GOES TO DB DIRECTLY (LIVE CHECK).
 *
 * @param {import('discord.js').Interaction | import('discord.js').Message} context
 * @param {string} commandName
 * @returns {Promise<boolean>}
 */
async function isAdmin(context, commandName) {
    const user = context.user || context.author;
    const member = context.member;
    const guild = context.guild;

    if (!user) return false;

    // Get user roles
    const roles = [];
    const roleIds = [];

    if (member && member.roles) {
        if (member.roles.cache) {
            member.roles.cache.forEach(r => {
                roles.push(r.name);
                roleIds.push(r.id);
            });
        } else if (Array.isArray(member.roles) && guild) {
            member.roles.forEach(roleId => {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    roles.push(role.name);
                    roleIds.push(role.id);
                }
            });
        }
    }

    return await checkPermissionLive(commandName, user.id, user.username, roles, roleIds);
}

/**
 * Checks if the user has permission to use a specific admin command.
 * USES LOCAL CACHE - NO DB HIT.
 *
 * @param {import('discord.js').Interaction | import('discord.js').Message} context
 * @param {string} commandName
 * @returns {boolean}
 */
function isAdminSync(context, commandName) {
    const user = context.user || context.author;
    const member = context.member;
    const guild = context.guild;

    if (!user) return false;

    const permissions = getPermissionsSync(commandName);
    if (!permissions) return false;

    // Get user roles
    const roles = [];
    const roleIds = [];

    if (member && member.roles) {
        if (member.roles.cache) {
            member.roles.cache.forEach(r => {
                roles.push(r.name);
                roleIds.push(r.id);
            });
        } else if (Array.isArray(member.roles) && guild) {
            member.roles.forEach(roleId => {
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    roles.push(role.name);
                    roleIds.push(role.id);
                }
            });
        }
    }

    const { roles: allowedRoles, users: allowedUsers } = permissions;
    const lowerRoles = roles.map(r => r.toLowerCase());

    const isUserAllowed = allowedUsers.some(u => u === user.id || u === user.username);
    const isRoleAllowed = allowedRoles.some(r => lowerRoles.includes(r.toLowerCase()) || roleIds.includes(r));

    return isUserAllowed || isRoleAllowed;
}

module.exports = { isAdmin, isAdminSync };
