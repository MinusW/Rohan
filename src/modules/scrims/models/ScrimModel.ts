import { Schema, model, Document } from 'mongoose';

export enum ScrimStatus {
    Open = 'open',
    Applied = 'applied',
    Confirmed = 'confirmed',
    Cancelled = 'cancelled',
    Expired = 'expired',
    Concluded = 'concluded'
}

export interface IScrimApplicant {
    userId: string;
    appliedAt: Date;
    status: 'pending' | 'accepted' | 'declined';
}

export interface IScrimDocument extends Document {
    guildId: string;
    channelId: string;
    messageId: string;
    threadId: string;
    creatorId: string;
    scheduledAt: Date;
    tier: string;
    matchCount: number;
    extraInfo?: string;
    status: ScrimStatus;
    applicants: IScrimApplicant[];
    applicantMessageIds: Map<string, string>; // applicantId -> messageId in thread
    notifiedStart: boolean;
    createdAt: Date;
}

const ScrimApplicantSchema = new Schema<IScrimApplicant>({
    userId: { type: String, required: true },
    appliedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
}, { _id: false });

const ScrimSchema = new Schema<IScrimDocument>({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true },
    threadId: { type: String, required: true },
    creatorId: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    tier: { type: String, required: true },
    matchCount: { type: Number, required: true },
    extraInfo: { type: String },
    status: { type: String, enum: Object.values(ScrimStatus), default: ScrimStatus.Open },
    applicants: { type: [ScrimApplicantSchema], default: [] },
    applicantMessageIds: { type: Map, of: String, default: new Map() },
    notifiedStart: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

ScrimSchema.index({ guildId: 1, channelId: 1 });
ScrimSchema.index({ scheduledAt: 1, status: 1 });

export const ScrimModel = model<IScrimDocument>('Scrim', ScrimSchema);
