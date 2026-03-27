const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
const shopPath = path.join(dataDir, 'shop.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

function readShop() {
    if (!fs.existsSync(shopPath)) {
        fs.writeFileSync(shopPath, JSON.stringify({ roles: [], metadata: {} }, null, 4));
    }
    try {
        const data = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
        if (!data.metadata) data.metadata = {};
        return data;
    } catch (e) {
        return { roles: [], metadata: {} };
    }
}

function writeShop(data) {
    fs.writeFileSync(shopPath, JSON.stringify(data, null, 4));
}

function getMetadata() {
    return readShop().metadata;
}

function updateMetadata(metadata) {
    const data = readShop();
    data.metadata = { ...data.metadata, ...metadata };
    writeShop(data);
}

function getRoles() {
    return readShop().roles;
}

function addRole(roleId, roleName, price) {
    const data = readShop();
    if (!data.roles) data.roles = [];
    
    if (data.roles.find(r => r.id === roleId)) {
        return false;
    }
    
    data.roles.push({ id: roleId, name: roleName, price: price });
    writeShop(data);
    return true;
}

function deleteRole(roleId) {
    const data = readShop();
    data.roles = data.roles.filter(r => r.id !== roleId);
    writeShop(data);
    return true;
}

function getRole(roleId) {
    const data = readShop();
    return data.roles.find(r => r.id === roleId) || null;
}

module.exports = { getRoles, addRole, deleteRole, getRole, getMetadata, updateMetadata };
