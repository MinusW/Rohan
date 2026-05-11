import { injectable } from 'tsyringe';
import { IScrimRepository } from '@/modules/scrims/repositories/IScrimRepository';
import { ScrimModel, IScrimDocument, ScrimStatus } from '@/modules/scrims/models/ScrimModel';

@injectable()
export class ScrimRepository implements IScrimRepository {
    public async create(data: Partial<IScrimDocument>): Promise<IScrimDocument> {
        return ScrimModel.create(data);
    }

    public async getById(scrimId: string): Promise<IScrimDocument | null> {
        return ScrimModel.findById(scrimId);
    }

    public async getByMessageId(messageId: string): Promise<IScrimDocument | null> {
        return ScrimModel.findOne({ messageId });
    }

    public async getActiveByChannel(channelId: string): Promise<IScrimDocument[]> {
        return ScrimModel.find({
            channelId,
            status: { $nin: [ScrimStatus.Cancelled, ScrimStatus.Expired, ScrimStatus.Concluded] }
        }).sort({ scheduledAt: 1 });
    }

    public async update(scrimId: string, data: Partial<IScrimDocument>): Promise<IScrimDocument | null> {
        return ScrimModel.findByIdAndUpdate(scrimId, data, { returnDocument: 'after' });
    }

    public async delete(scrimId: string): Promise<void> {
        await ScrimModel.findByIdAndDelete(scrimId);
    }

    public async getExpired(): Promise<IScrimDocument[]> {
        return ScrimModel.find({
            scheduledAt: { $lt: new Date() },
            status: { $nin: [ScrimStatus.Cancelled, ScrimStatus.Expired, ScrimStatus.Concluded] }
        });
    }

    public async getScrimsToNotify(): Promise<IScrimDocument[]> {
        const now = new Date();
        return ScrimModel.find({
            scheduledAt: { $lte: now },
            status: ScrimStatus.Confirmed,
            notifiedStart: false
        });
    }

    public async countActiveByUser(guildId: string, userId: string): Promise<number> {
        return ScrimModel.countDocuments({
            guildId,
            creatorId: userId,
            status: { $in: [ScrimStatus.Open, ScrimStatus.Applied, ScrimStatus.Confirmed] }
        });
    }

    public async deleteMany(scrimIds: string[]): Promise<void> {
        await ScrimModel.deleteMany({ _id: { $in: scrimIds } });
    }
}
