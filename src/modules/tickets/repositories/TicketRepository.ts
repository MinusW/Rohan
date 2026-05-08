import { injectable } from 'tsyringe';
import { ITicketRepository } from '@/modules/tickets/repositories/ITicketRepository';
import { TicketModel } from '@/modules/tickets/models/TicketModel';

@injectable()
export class TicketRepository implements ITicketRepository {
    public async create(data: { ownerId: string }): Promise<void> {
        await TicketModel.create(data);
    }
}
