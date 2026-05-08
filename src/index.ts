import 'reflect-metadata';
import { BotClient } from './core/BotClient';
import { Database } from './core/Database';
import { config } from 'dotenv';

// Load environment variables
config();

async function bootstrap() {
    try {
        // Connect to MongoDB
        await Database.connect();

        // Initialize and start the bot
        const client = new BotClient();
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('Failed to start the bot:', error);
        process.exit(1);
    }
}

bootstrap();
