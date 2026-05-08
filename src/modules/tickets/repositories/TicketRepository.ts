import { injectable } from 'tsyringe';
import { ITicketRepository } from './ITicketRepository';
import { TicketModel } from '../models/TicketModel';

@injectable()
export class TicketRepository implements ITicketRepository {
    public async create(data: { ownerId: string }): Promise<void> {
        await TicketModel.create(data);
    }
}
