import { Listener } from '@sapphire/framework';
import { container } from 'tsyringe';
import { IScrimService } from '@/modules/scrims/services/IScrimService';
import { ILogger } from '@/common/utils/logger/ILogger';
import { Client } from 'discord.js';

const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

export class ScrimCleanupTask extends Listener {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'ready',
            once: true
        });
    }

    public async run(client: Client) {
        const logger = container.resolve<ILogger>('ILogger');
        logger.info('Scrim background tasks started. Running every minute.');

        // Run immediately once, then on interval
        await this.runTasks(client, logger);

        setInterval(async () => {
            await this.runTasks(client, logger);
        }, CLEANUP_INTERVAL_MS);
    }

    private async runTasks(client: Client, logger: ILogger): Promise<void> {
        try {
            const scrimService = container.resolve<IScrimService>('IScrimService');
            await scrimService.cleanupExpiredScrims(client);
            await scrimService.notifyScrimStarts(client);
        } catch (error) {
            logger.error('Error during scrim background tasks:', error);
        }
    }
}
