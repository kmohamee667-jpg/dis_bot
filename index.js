require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,      // Required to receive messages
        GatewayIntentBits.MessageContent,     // Required to read message content
    ],
    rest: {
        timeout: 60000 // زيادة وقت الانتظار للاتصال لتجنب أخطاء التايم أوت
    }
});

client.commands = new Collection();

function loadCommands(client) {
    const commandsPath = path.join(__dirname, 'commands');
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded command: ${command.data.name}`);
            } else {
                console.warn(`⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
}
loadCommands(client);

// Load events first
function loadEvents(client) {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`🔌 Loaded event: ${event.name}`);
    }
}

loadEvents(client);

// Suppress unhandled errors
client.on('error', (error) => console.error('Discord Client Error:', error));
client.ws.on('error', (error) => console.error('Discord WS Error:', error));
process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));

client.login(process.env.TOKEN);

