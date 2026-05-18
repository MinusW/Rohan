import { Guild } from 'discord.js';
import { IScrimConfigDocument, IScrimTier } from '@/modules/scrims/models/ScrimConfigModel';

export interface IScrimConfigService {
    getConfig(guildId: string): Promise<IScrimConfigDocument>;
    addScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    removeScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    setLogChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    removeLogChannel(guildId: string): Promise<IScrimConfigDocument>;
    setScheduleChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument>;
    removeScheduleChannel(guildId: string): Promise<IScrimConfigDocument>;
    addTier(guildId: string, name: string, description: string, guild?: Guild): Promise<IScrimConfigDocument>;
    removeTier(guildId: string, tierName: string, guild?: Guild): Promise<IScrimConfigDocument>;
    updatePanel(guild: Guild, channelId: string): Promise<void>;
    updateAllPanels(guild: Guild): Promise<void>;
}
