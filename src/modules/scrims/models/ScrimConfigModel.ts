import { Schema, model, Document } from 'mongoose';

export interface IScrimTier {
    name: string;
    description: string;
}

export interface IScrimConfigDocument extends Document {
    guildId: string;
    scrimChannelIds: string[];
    logChannelId?: string;
    scheduleChannelId?: string;
    tiers: IScrimTier[];
    panelMessageIds: Map<string, string>;
}

const ScrimTierSchema = new Schema<IScrimTier>({
    name: { type: String, required: true },
    description: { type: String, required: true }
}, { _id: false });

const ScrimConfigSchema = new Schema<IScrimConfigDocument>({
    guildId: { type: String, required: true, unique: true },
    scrimChannelIds: { type: [String], default: [] },
    logChannelId: { type: String },
    scheduleChannelId: { type: String },
    tiers: { type: [ScrimTierSchema], default: [] },
    panelMessageIds: { type: Map, of: String, default: new Map() }
});

export const ScrimConfigModel = model<IScrimConfigDocument>('ScrimConfig', ScrimConfigSchema);
