const { isAdmin } = require('./utils/admin-check');

// Mock config
// Depending on your actual config, you might need to adjust this
const mockConfig = require('./utils/config');

console.log('--- Testing Admin Check Utility ---');

// Test Case 1: Whitelisted User
const interaction1 = {
    user: { username: mockConfig.ALLOWED_USERNAMES[0] },
    member: null
};
console.log('Test 1 (Whitelisted):', isAdmin(interaction1) === true ? '✅ PASS' : '❌ FAIL');

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
