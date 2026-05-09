import { injectable } from 'tsyringe';
import { ISupportConfigRepository } from '@/modules/tickets/repositories/ISupportConfigRepository';
import { SupportConfigModel, ISupportConfigDocument, ITicketType } from '@/modules/tickets/models/SupportConfigModel';

@injectable()
export class SupportConfigRepository implements ISupportConfigRepository {
    public async getConfig(guildId: string): Promise<ISupportConfigDocument | null> {
        return SupportConfigModel.findOne({ guildId });
    }

    public async getOrCreateConfig(guildId: string): Promise<ISupportConfigDocument> {
        let config = await this.getConfig(guildId);
        if (!config) {
            config = await SupportConfigModel.create({ guildId });
        }
        return config;
    }

    public async setDiscordCategory(guildId: string, categoryId: string): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        config.discordCategoryId = categoryId;
        return config.save();
    }

    public async setLogChannel(guildId: string, channelId: string): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        config.logChannelId = channelId;
        return config.save();
    }

    public async setSupportRole(guildId: string, roleId: string): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        config.supportRoleId = roleId;
        return config.save();
    }

    public async addTicketType(guildId: string, ticketType: ITicketType): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        // Remove if exists
        config.ticketTypes = config.ticketTypes.filter(t => t.name !== ticketType.name);
        config.ticketTypes.push(ticketType);
        return config.save();
    }

    public async removeTicketType(guildId: string, typeName: string): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        config.ticketTypes = config.ticketTypes.filter(t => t.name !== typeName);
        return config.save();
    }

    public async incrementTicketCounter(guildId: string): Promise<number> {
        const config = await SupportConfigModel.findOneAndUpdate(
            { guildId },
            { $inc: { ticketCounter: 1 } },
            { returnDocument: 'after', upsert: true }
        );
        return config.ticketCounter;
    }
    public async setPanelInfo(guildId: string, channelId: string, messageId: string): Promise<ISupportConfigDocument> {
        const config = await this.getOrCreateConfig(guildId);
        config.panelChannelId = channelId;
        config.panelMessageId = messageId;
        return config.save();
    }
}
