import { Guild, User, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';

export interface ITicketService {
    createTicketChannel(guild: Guild, creator: User, ticketType: string, title: string, description: string): Promise<TextChannel | null>;
    claimTicket(guild: Guild, channelId: string, claimer: User): Promise<boolean>;
    transferTicket(guild: Guild, channelId: string, transferrer: User, newClaimer: User): Promise<boolean>;
    unclaimTicket(guild: Guild, channelId: string, unclaimer: User): Promise<boolean>;
    closeTicket(guild: Guild, channelId: string, closer: User, summary: string): Promise<{ embed: EmbedBuilder, row: ActionRowBuilder<ButtonBuilder> } | null>;
    reopenTicket(guild: Guild, channelId: string, reopener: User): Promise<boolean>;
    deleteTicketChannel(guild: Guild, channelId: string): Promise<boolean>;
}
