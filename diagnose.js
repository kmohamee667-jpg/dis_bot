require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Diagnostic: Bot is logged in as ${client.user.tag}`);
    const guilds = client.guilds.cache;
    console.log(`Diagnostic: Bot is currently in ${guilds.size} guilds:`);
    guilds.forEach(guild => {
        console.log(`- ${guild.name} (ID: ${guild.id})`);
    });
    
    const targetGuildId = '1468928668733673485';
    const targetGuild = await client.guilds.fetch(targetGuildId).catch(() => null);
    
    if (targetGuild) {
        console.log(`Diagnostic: Successfully fetched target guild: ${targetGuild.name}`);
    } else {
        console.log(`Diagnostic: FAILED to fetch target guild with ID: ${targetGuildId}`);
        console.log('Suggestion: Check if the bot is invited to this server and has the correct Guilds intent.');
    }
    
    process.exit(0);
});

client.login(process.env.TOKEN).catch(err => {
    console.error('Diagnostic Error: Failed to login:', err.message);
    process.exit(1);
});
