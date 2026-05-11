import { container } from 'tsyringe';
import { SqliteDatabase } from './SqliteDatabase';
import { TicketRepository } from '@/modules/tickets/repositories/TicketRepository';
import { TicketService } from '@/modules/tickets/services/TicketService';
import { SupportConfigRepository } from '@/modules/tickets/repositories/SupportConfigRepository';
import { SupportConfigService } from '@/modules/tickets/services/SupportConfigService';
import { SqliteTimezoneRepository } from '@/modules/timezone/repositories/SqliteTimezoneRepository';
import { TimezoneService } from '@/modules/timezone/services/TimezoneService';
import { ScrimConfigRepository } from '@/modules/scrims/repositories/ScrimConfigRepository';
import { ScrimConfigService } from '@/modules/scrims/services/ScrimConfigService';
import { ScrimRepository } from '@/modules/scrims/repositories/ScrimRepository';
import { ScrimService } from '@/modules/scrims/services/ScrimService';
import { WinstonLogger } from '@/common/utils/logger/WinstonLogger';
import { ILogger } from '@/common/utils/logger/ILogger';

export function setupContainer() {
    // Register global singletons, repositories, and services here
    container.registerSingleton('ILogger', WinstonLogger);
    container.registerSingleton('ITicketRepository', TicketRepository);
    container.registerSingleton('ISupportConfigRepository', SupportConfigRepository);
    container.registerSingleton('ISupportConfigService', SupportConfigService);
    container.registerSingleton('ITicketService', TicketService);
    container.registerSingleton(SqliteDatabase);
    container.registerSingleton('ITimezoneRepository', SqliteTimezoneRepository);
    container.registerSingleton('ITimezoneService', TimezoneService);
    container.registerSingleton('IScrimConfigRepository', ScrimConfigRepository);
    container.registerSingleton('IScrimConfigService', ScrimConfigService);
    container.registerSingleton('IScrimRepository', ScrimRepository);
    container.registerSingleton('IScrimService', ScrimService);
    
    const logger = container.resolve<ILogger>('ILogger');
    logger.info('Dependency Injection container initialized.');
}

export { container };
