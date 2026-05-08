import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';

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
}
