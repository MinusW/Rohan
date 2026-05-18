import { injectable } from 'tsyringe';
import { IScrimConfigRepository } from '@/modules/scrims/repositories/IScrimConfigRepository';
import { ScrimConfigModel, IScrimConfigDocument, IScrimTier } from '@/modules/scrims/models/ScrimConfigModel';

@injectable()
export class ScrimConfigRepository implements IScrimConfigRepository {
    public async getOrCreateConfig(guildId: string): Promise<IScrimConfigDocument> {
        let config = await ScrimConfigModel.findOne({ guildId });
        if (!config) {
            config = await ScrimConfigModel.create({ guildId });
        }
        return config;
    }

    public async addScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $addToSet: { scrimChannelIds: channelId } },
            { upsert: true, returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async removeScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        const config = await ScrimConfigModel.findOneAndUpdate(
            { guildId },
            {
                $pull: { scrimChannelIds: channelId },
                $unset: { [`panelMessageIds.${channelId}`]: '' }
            },
            { returnDocument: 'after' }
        );
        return config as IScrimConfigDocument;
    }

    public async setLogChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $set: { logChannelId: channelId } },
            { upsert: true, returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async removeLogChannel(guildId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $unset: { logChannelId: '' } },
            { returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async setScheduleChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $set: { scheduleChannelId: channelId } },
            { upsert: true, returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async removeScheduleChannel(guildId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $unset: { scheduleChannelId: '' } },
            { returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async addTier(guildId: string, tier: IScrimTier): Promise<IScrimConfigDocument> {
        // Use a filter to ensure we don't add a tier with the same name (case-insensitive)
        const config = await ScrimConfigModel.findOne({ guildId });
        if (config) {
            const exists = config.tiers.some(t => t.name.toLowerCase() === tier.name.toLowerCase());
            if (exists) return config;
        }

        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $push: { tiers: tier } },
            { upsert: true, returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async removeTier(guildId: string, tierName: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $pull: { tiers: { name: tierName } } },
            { returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async setPanelMessageId(guildId: string, channelId: string, messageId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $set: { [`panelMessageIds.${channelId}`]: messageId } },
            { returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }

    public async removePanelMessageId(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        return ScrimConfigModel.findOneAndUpdate(
            { guildId },
            { $unset: { [`panelMessageIds.${channelId}`]: '' } },
            { returnDocument: 'after' }
        ) as Promise<IScrimConfigDocument>;
    }
}
