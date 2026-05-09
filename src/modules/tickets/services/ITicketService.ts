import { Guild, User, TextChannel } from 'discord.js';
import { ITicketDocument } from '@/modules/tickets/models/TicketModel';

export interface ITicketService {
    createTicketChannel(guild: Guild, creator: User, ticketType: string, title: string, description: string): Promise<TextChannel | null>;
    claimTicket(guild: Guild, channelId: string, claimer: User): Promise<boolean>;
    closeTicket(guild: Guild, channelId: string, closer: User, summary: string): Promise<boolean>;
    reopenTicket(guild: Guild, channelId: string, reopener: User): Promise<boolean>;
    deleteTicketChannel(guild: Guild, channelId: string): Promise<boolean>;
}
