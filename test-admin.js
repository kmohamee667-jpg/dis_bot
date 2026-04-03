const { isAdmin } = require('./utils/admin-check');

// Mock config
// Depending on your actual config, you might need to adjust this
// Mock DB permissions (no config.js dependency)
const mockPermissions = {
    testcmd: { 
        users: ['testadmin'], 
        roles: ['Admin', 'Owner']
    }
};

// Mock DB for testing - override cache
const configDb = require('./utils/configDb');
const originalGetPermissionsSync = configDb.getPermissionsSync;
configDb.getPermissionsSync = function(cmd) {
    if (cmd === 'testcmd') {
        return { users: ['testadmin'], roles: ['Admin', 'Owner'] };
    }
    return null;
};

console.log('--- Testing Admin Check (DB Mock) ---');

// Test 1: User permission
const interaction1 = {
    user: { username: 'testadmin' },
    member: null
};
console.log('Test 1 User (testcmd):', isAdmin(interaction1, 'testcmd') ? '✅ PASS' : '❌ FAIL');

// Test 2: Role permission
const interaction2 = {
    user: { username: 'normal_user' },
    member: { 
        roles: { 
            cache: [ 
                { name: 'Owner' }
            ] 
        } 
    }
};
interaction2.member.roles.cache.some = Array.prototype.some;
console.log('Test 2 Role (Owner):', isAdmin(interaction2, 'testcmd') ? '✅ PASS' : '❌ FAIL');

// Test 3: No permission
const interaction3 = {
    user: { username: 'random' },
    member: { 
        roles: { cache: [{ name: 'Member' }] } 
    }
};
interaction3.member.roles.cache.some = Array.prototype.some;
console.log('Test 3 No Perm:', !isAdmin(interaction3, 'testcmd') ? '✅ PASS' : '❌ FAIL');

// Test Case 2: User with Admin Role (Cached)
const interaction2 = {
    user: { username: 'normal_user' },
    member: {
        roles: {
            cache: [
                { name: 'CEO' }
            ]
        }
    }
};
// Add .some mock for collection
interaction2.member.roles.cache.some = Array.prototype.some;
console.log('Test 2 (Admin Role Cached):', isAdmin(interaction2) === true ? '✅ PASS' : '❌ FAIL');

// Test Case 3: User with Admin Role (API array - fallback)
// For this we need to mock interaction.guild.roles.cache.get
const interaction3 = {
    user: { username: 'api_user' },
    member: {
        roles: ['12345']
    },
    guild: {
        roles: {
            cache: {
                get: (id) => id === '12345' ? { name: 'Owner' } : null
            }
        }
    }
};
console.log('Test 3 (Admin Role API Array):', isAdmin(interaction3) === true ? '✅ PASS' : '❌ FAIL');

// Test Case 4: Normal User
const interaction4 = {
    user: { username: 'random' },
    member: {
        roles: {
            cache: [
                { name: 'Member' }
            ]
        }
    }
};
interaction4.member.roles.cache.some = Array.prototype.some;
console.log('Test 4 (Normal User):', isAdmin(interaction4) === false ? '✅ PASS' : '❌ FAIL');

console.log('--- Testing Complete ---');
