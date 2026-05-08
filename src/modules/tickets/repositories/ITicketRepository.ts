export interface ITicketRepository {
    create(data: { ownerId: string }): Promise<void>;
}
