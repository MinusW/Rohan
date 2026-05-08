import { injectable, inject } from 'tsyringe';
import { ITicketService } from './ITicketService';
import { ITicketRepository } from '../repositories/ITicketRepository';
import { ILogger } from '../../../common/utils/logger/ILogger';

@injectable()
export class TicketService implements ITicketService {
    constructor(
        @inject('ITicketRepository') private readonly ticketRepository: ITicketRepository,
        @inject('ILogger') private readonly logger: ILogger
    ) {}

    public async createTicket(userId: string): Promise<void> {
        await this.ticketRepository.create({ ownerId: userId });
        this.logger.info(`Ticket created for user ${userId}`);
        // Additional business logic like assigning roles, creating channels, etc.
    }
}
