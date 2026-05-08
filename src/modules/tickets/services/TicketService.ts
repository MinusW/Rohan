import { injectable, inject } from 'tsyringe';
import { ITicketService } from './ITicketService';
import { ITicketRepository } from '../repositories/ITicketRepository';

@injectable()
export class TicketService implements ITicketService {
    constructor(
        @inject('ITicketRepository') private readonly ticketRepository: ITicketRepository
    ) {}

    public async createTicket(userId: string): Promise<void> {
        await this.ticketRepository.create({ ownerId: userId });
        // Additional business logic like assigning roles, creating channels, etc.
    }
}
