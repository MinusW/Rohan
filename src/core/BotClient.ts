import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { setupContainer } from './Container';

export class BotClient extends SapphireClient {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
            ],
            // Additional Sapphire options can be configured here
        });
    }

    public override async login(token?: string) {
        // Setup Dependency Injection container before logging in
        setupContainer();
        
        return super.login(token);
    }
}
