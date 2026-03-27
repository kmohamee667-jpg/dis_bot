const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		commands.push(command.data.toJSON());
	}
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.options.timeout = 60000; // Force timeout setting

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
        // This registers commands for a specific guild. 
        // For global commands, use: Routes.applicationCommands('APPLICATION_ID')
        await rest.put(
            Routes.applicationGuildCommands('1468926065853468672', '1476589188932440094'),
            { body: commands }
        );
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();


