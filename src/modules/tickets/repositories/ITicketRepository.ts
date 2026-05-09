import { ITicketDocument } from '@/modules/tickets/models/TicketModel';

export interface ITicketRepository {
    create(data: Partial<ITicketDocument>): Promise<ITicketDocument>;
    getByChannelId(channelId: string): Promise<ITicketDocument | null>;
    update(channelId: string, data: Partial<ITicketDocument>): Promise<ITicketDocument | null>;
    delete(channelId: string): Promise<void>;
    countOpenTickets(guildId: string, creatorId: string): Promise<number>;
}
