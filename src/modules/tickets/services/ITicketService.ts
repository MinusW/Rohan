export interface ITicketService {
    createTicket(userId: string): Promise<void>;
}
