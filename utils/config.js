/**
 * Per-Command Permissions Configuration
 * 
 * Each admin command has its own permissions object:
 *   - roles: Array of Discord Role Names OR Role IDs that can use this command
 *   - users: Array of Discord usernames that can use this command
 * 
 * If a user is NOT in the command's users list AND does NOT have
 * any of the command's roles, they will be denied access.
 */
module.exports = {
    PERMISSIONS: {
        // /give — Give coins to users
        'give': {
            roles: ['معلم', 'معلمه'],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // /rm-coins — Reset coins for a user or all
        'rm-coins': {
            roles: [],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // /coins (viewing other users) — View another user's balance
        'coins': {
            roles: ['معلم', 'معلمه'],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.', 'kaaaa11_11']
        },

        // /add-role — Add a role to the shop
        'add-role': {
            roles: [],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // /delete-role — Delete a role from the shop
        'delete-role': {
            roles: [],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // /edit-price — Edit a shop role's price
        'edit-price': {
            roles: [],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // /shop setup — Setup the persistent shop message
        'shop-setup': {
            roles: [],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // Timer Stop — Users/Roles who can stop ANY timer (even if they didn't start it)
        'timer-stop': {
            roles: ['OWNER'],
            users: ['adham3963', 'x99gg', 'khal3d0047', '_erllo__.']
        },

        // مسح — Delete messages in a channel (keyword command)
        'مسح': {
            roles: ['Admin','dev','bots','OWNER','Mod','head admin','trial mod','staff support','معلم','معلمه'],
            users: ['adham3963', 'khal3d0047', '_erllo__.']
        },
    }
};

