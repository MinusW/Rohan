import { Guild } from 'discord.js';
import { ISupportConfigDocument, ITicketType } from '@/modules/tickets/models/SupportConfigModel';

export interface ISupportConfigService {
    getConfig(guildId: string): Promise<ISupportConfigDocument>;
    setDiscordCategory(guildId: string, categoryId: string): Promise<ISupportConfigDocument>;
    setLogChannel(guildId: string, channelId: string): Promise<ISupportConfigDocument>;
    setSupportRole(guildId: string, roleId: string): Promise<ISupportConfigDocument>;
    addTicketType(guildId: string, name: string, description: string, color: string, emoji?: string, guild?: Guild): Promise<ISupportConfigDocument>;
    removeTicketType(guildId: string, name: string, guild?: Guild): Promise<ISupportConfigDocument>;
    incrementTicketCounter(guildId: string): Promise<number>;
    setPanelInfo(guildId: string, channelId: string, messageId: string): Promise<ISupportConfigDocument>;
    updatePanel(guild: Guild): Promise<void>;
}
