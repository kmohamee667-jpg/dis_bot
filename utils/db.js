const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const usersPath = path.join(dataDir, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// تأكد من وجود الملف أو إنشاؤه
function readUsers() {
    if (!fs.existsSync(usersPath)) {
        fs.writeFileSync(usersPath, JSON.stringify({}, null, 4));
    }
    try {
        return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (e) {
        // في حالة وجود خطأ في قراءة الـ JSON
        return {};
    }
}

function writeUsers(data) {
    fs.writeFileSync(usersPath, JSON.stringify(data, null, 4));
}

function getUser(userId) {
    const users = readUsers();
    return users[userId] || null;
}

function createUser(userId, username, initialCoins = 0) {
    const users = readUsers();
    users[userId] = { 
        username: username, 
        coins: initialCoins,
        lastAdded: initialCoins > 0 ? new Date().toISOString() : null,
        dailyLastClaimed: null
    };
    writeUsers(users);
    return users[userId];
}

function updateUserCoins(userId, username, newCoins, updateLastAdded = false) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = { username: username, coins: 0, lastAdded: null, dailyLastClaimed: null };
    } else {
        users[userId].username = username;
    }
    
    if (updateLastAdded && newCoins > users[userId].coins) {
        users[userId].lastAdded = new Date().toISOString();
    }
    
    users[userId].coins = newCoins;
    writeUsers(users);
    return users[userId];
}

function setLastClaimed(userId) {
    const users = readUsers();
    if (users[userId]) {
        users[userId].dailyLastClaimed = new Date().toISOString();
        writeUsers(users);
    }
}

function resetAllCoins() {
    const users = readUsers();
    for (const userId in users) {
        users[userId].coins = 0;
    }
    writeUsers(users);
}

function resetUserCoins(userId) {
    const users = readUsers();
    if (users[userId]) {
        users[userId].coins = 0;
        writeUsers(users);
    }
}

module.exports = { getUser, createUser, updateUserCoins, setLastClaimed, resetAllCoins, resetUserCoins };
