const { ALLOWED_USERNAMES } = require('./config');

/**
 * Checks if the user who triggered the interaction is an administrator.
 * Handles both Cached Members (Manager) and API Members (Array of IDs).
 * 
 * @param {import('discord.js').Interaction} interaction 
 * @returns {boolean}
 */
function isAdmin(interaction) {
    const adminRoleNames = ['ceo', 'owner', 'dev'];

    // 1. Check if the user is explicitly whitelisted in config.js
    const isWhitelisted = ALLOWED_USERNAMES.includes(interaction.user.username);
    if (isWhitelisted) return true;

    // 2. Must be in a guild context for role checks
    if (!interaction.member || !interaction.member.roles) return false;

    // 3. Handle GuildMemberRoleManager (most common in discord.js v14)
    if (interaction.member.roles.cache) {
        return interaction.member.roles.cache.some(role => 
            adminRoleNames.includes(role.name.toLowerCase())
        );
    }

    // 4. Handle raw API Member (interaction.member.roles is an Array of IDs)
    if (Array.isArray(interaction.member.roles) && interaction.guild) {
        return interaction.member.roles.some(roleId => {
            const role = interaction.guild.roles.cache.get(roleId);
            return role && adminRoleNames.includes(role.name.toLowerCase());
        });
    }

    return false;
}

module.exports = { isAdmin };
