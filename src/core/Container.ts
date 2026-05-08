import { container } from 'tsyringe';
import { TicketRepository } from '../modules/tickets/repositories/TicketRepository';
import { TicketService } from '../modules/tickets/services/TicketService';
import { WinstonLogger } from '../common/utils/logger/WinstonLogger';
import { ILogger } from '../common/utils/logger/ILogger';

export function setupContainer() {
    // Register global singletons, repositories, and services here
    container.registerSingleton('ILogger', WinstonLogger);
    container.registerSingleton('ITicketRepository', TicketRepository);
    container.registerSingleton('ITicketService', TicketService);
    
    const logger = container.resolve<ILogger>('ILogger');
    logger.info('Dependency Injection container initialized.');
}

export { container };
