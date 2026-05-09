import { ISupportConfigDocument, ITicketType } from '@/modules/tickets/models/SupportConfigModel';

export interface ISupportConfigRepository {
    getConfig(guildId: string): Promise<ISupportConfigDocument | null>;
    getOrCreateConfig(guildId: string): Promise<ISupportConfigDocument>;
    setDiscordCategory(guildId: string, categoryId: string): Promise<ISupportConfigDocument>;
    setLogChannel(guildId: string, channelId: string): Promise<ISupportConfigDocument>;
    setSupportRole(guildId: string, roleId: string): Promise<ISupportConfigDocument>;
    addTicketType(guildId: string, ticketType: ITicketType): Promise<ISupportConfigDocument>;
    removeTicketType(guildId: string, typeName: string): Promise<ISupportConfigDocument>;
    incrementTicketCounter(guildId: string): Promise<number>;
    setPanelInfo(guildId: string, channelId: string, messageId: string): Promise<ISupportConfigDocument>;
}
