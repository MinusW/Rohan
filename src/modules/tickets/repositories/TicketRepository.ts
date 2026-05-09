import { injectable } from 'tsyringe';
import { ITicketRepository } from '@/modules/tickets/repositories/ITicketRepository';
import { TicketModel, ITicketDocument } from '@/modules/tickets/models/TicketModel';

@injectable()
export class TicketRepository implements ITicketRepository {
    public async create(data: Partial<ITicketDocument>): Promise<ITicketDocument> {
        return TicketModel.create(data);
    }

    public async getByChannelId(channelId: string): Promise<ITicketDocument | null> {
        return TicketModel.findOne({ channelId });
    }

    public async update(channelId: string, data: Partial<ITicketDocument>): Promise<ITicketDocument | null> {
        return TicketModel.findOneAndUpdate({ channelId }, data, { returnDocument: 'after' });
    }

    public async delete(channelId: string): Promise<void> {
        await TicketModel.findOneAndDelete({ channelId });
    }

    public async countOpenTickets(guildId: string, creatorId: string): Promise<number> {
        return TicketModel.countDocuments({ guildId, creatorId, status: { $in: ['open', 'claimed'] } });
    }
}
