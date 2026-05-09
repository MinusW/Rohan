import { Schema, model, Document } from 'mongoose';

export interface IResolutionEntry {
    summary: string;
    closerId: string;
    closedAt: Date;
}

export interface ITicketDocument extends Document {
    guildId: string;
    channelId: string;
    creatorId: string;
    claimerId?: string;
    ticketType: string;
    title: string;
    description: string;
    status: string;
    logMessageId?: string;
    ticketNumber: number;
    resolutions: IResolutionEntry[];
    createdAt: Date;
}

const ResolutionSchema = new Schema<IResolutionEntry>({
    summary: { type: String, required: true },
    closerId: { type: String, required: true },
    closedAt: { type: Date, default: Date.now }
}, { _id: false });

const TicketSchema = new Schema<ITicketDocument>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    creatorId: { type: String, required: true },
    claimerId: { type: String },
    ticketType: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, default: 'open' },
    logMessageId: { type: String },
    ticketNumber: { type: Number, required: true },
    resolutions: { type: [ResolutionSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
});

export const TicketModel = model<ITicketDocument>('Ticket', TicketSchema);
