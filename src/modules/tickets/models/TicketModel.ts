import { Schema, model, Document } from 'mongoose';

export interface ITicketDocument extends Document {
    ownerId: string;
    status: string;
    createdAt: Date;
}

const TicketSchema = new Schema<ITicketDocument>({
    ownerId: { type: String, required: true },
    status: { type: String, default: 'open' },
    createdAt: { type: Date, default: Date.now }
});

export const TicketModel = model<ITicketDocument>('Ticket', TicketSchema);
