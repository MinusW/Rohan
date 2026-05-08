import 'reflect-metadata';
import { BotClient } from '@/core/BotClient';
import { Database } from '@/core/Database';
import { config } from 'dotenv';
import { container, setupContainer } from '@/core/Container';
import { ILogger } from '@/common/utils/logger/ILogger';

// Load environment variables
config();

async function bootstrap() {
    try {
        // Setup Dependency Injection container before everything else
        setupContainer();
        const logger = container.resolve<ILogger>('ILogger');

        // Connect to MongoDB
        await Database.connect();

        // Initialize and start the bot
        const client = new BotClient();
        await client.login(process.env.DISCORD_TOKEN);
        
        logger.info('Bot client logged in successfully.');
    } catch (error) {
        // Fallback to console if container is not initialized yet
        if (container.isRegistered('ILogger')) {
            const logger = container.resolve<ILogger>('ILogger');
            logger.error('Failed to start the bot:', error);
        } else {
            console.error('Failed to start the bot:', error);
        }
        process.exit(1);
    }
}

bootstrap();
