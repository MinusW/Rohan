import { IScrimConfigDocument, IScrimTier } from '@/modules/scrims/models/ScrimConfigModel';

export interface IScrimConfigRepository {
    getOrCreateConfig(guildId: string): Promise<IScrimConfigDocument>;
    addScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    removeScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    setLogChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    setScheduleChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    addTier(guildId: string, tier: IScrimTier): Promise<IScrimConfigDocument>;
    removeTier(guildId: string, tierName: string): Promise<IScrimConfigDocument>;
    setPanelMessageId(guildId: string, channelId: string, messageId: string): Promise<IScrimConfigDocument>;
    removePanelMessageId(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
}
