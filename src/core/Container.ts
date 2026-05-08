import { container } from 'tsyringe';
import { TicketRepository } from '../modules/tickets/repositories/TicketRepository';
import { TicketService } from '../modules/tickets/services/TicketService';

export function setupContainer() {
    // Register global singletons, repositories, and services here
    container.registerSingleton('ITicketRepository', TicketRepository);
    container.registerSingleton('ITicketService', TicketService);
    
    console.log('Dependency Injection container initialized.');
}

export { container };
