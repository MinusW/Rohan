import { Schema, model, Document } from 'mongoose';

export interface ITicketType {
    name: string;
    description: string;
    color: string;
    emoji?: string;
}

export interface ISupportConfigDocument extends Document {
    guildId: string;
    discordCategoryId?: string;
    logChannelId?: string;
    supportRoleId?: string;
    ticketTypes: ITicketType[];
    ticketCounter: number;
    panelMessageId?: string;
    panelChannelId?: string;
}

const TicketTypeSchema = new Schema<ITicketType>({
    name: { type: String, required: true },
    description: { type: String, required: true },
    color: { type: String, required: true, default: 'Blue' },
    emoji: { type: String }
}, { _id: false });

const SupportConfigSchema = new Schema<ISupportConfigDocument>({
    guildId: { type: String, required: true, unique: true },
    discordCategoryId: { type: String },
    logChannelId: { type: String },
    supportRoleId: { type: String },
    panelMessageId: { type: String },
    panelChannelId: { type: String },
    ticketTypes: { type: [TicketTypeSchema], default: [] },
    ticketCounter: { type: Number, default: 0 }
});

export const SupportConfigModel = model<ISupportConfigDocument>('SupportConfig', SupportConfigSchema);
