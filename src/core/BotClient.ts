import { SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits } from 'discord.js';
import { join } from 'path';

export class BotClient extends SapphireClient {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
            ]
        });

        this.stores.get('commands').registerPath(join(__dirname, '../modules/tickets/commands'));
        this.stores.get('listeners').registerPath(join(__dirname, '../modules/tickets/listeners'));

        this.stores.get('commands').registerPath(join(__dirname, '../modules/timezone/commands'));

        this.stores.get('commands').registerPath(join(__dirname, '../modules/scrims/commands'));
        this.stores.get('listeners').registerPath(join(__dirname, '../modules/scrims/listeners'));
    }
}
