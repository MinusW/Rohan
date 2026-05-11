import { injectable, inject } from 'tsyringe';
import { Guild, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { ISupportConfigService } from '@/modules/tickets/services/ISupportConfigService';
import { ISupportConfigRepository } from '@/modules/tickets/repositories/ISupportConfigRepository';
import { ISupportConfigDocument } from '@/modules/tickets/models/SupportConfigModel';
import { ILogger } from '@/common/utils/logger/ILogger';

@injectable()
export class SupportConfigService implements ISupportConfigService {
    constructor(
        @inject('ISupportConfigRepository') private readonly configRepository: ISupportConfigRepository,
        @inject('ILogger') private readonly logger: ILogger
    ) {}

    public async getConfig(guildId: string): Promise<ISupportConfigDocument> {
        return this.configRepository.getOrCreateConfig(guildId);
    }

    public async setDiscordCategory(guildId: string, categoryId: string): Promise<ISupportConfigDocument> {
        this.logger.info(`Setting discord category for guild ${guildId} to ${categoryId}`);
        return this.configRepository.setDiscordCategory(guildId, categoryId);
    }

    public async setLogChannel(guildId: string, channelId: string): Promise<ISupportConfigDocument> {
        this.logger.info(`Setting log channel for guild ${guildId} to ${channelId}`);
        return this.configRepository.setLogChannel(guildId, channelId);
    }

    public async setSupportRole(guildId: string, roleId: string): Promise<ISupportConfigDocument> {
        this.logger.info(`Setting support role for guild ${guildId} to ${roleId}`);
        return this.configRepository.setSupportRole(guildId, roleId);
    }

    public async addTicketType(guildId: string, name: string, description: string, color: string, emoji?: string, guild?: Guild): Promise<ISupportConfigDocument> {
        this.logger.info(`Adding ticket type ${name} with color ${color}${emoji ? ` and emoji ${emoji}` : ''} for guild ${guildId}`);
        const config = await this.configRepository.addTicketType(guildId, { name, description, color, emoji });
        if (guild) await this.updatePanel(guild).catch(() => null);
        return config;
    }

    public async removeTicketType(guildId: string, name: string, guild?: Guild): Promise<ISupportConfigDocument> {
        this.logger.info(`Removing ticket type ${name} for guild ${guildId}`);
        const config = await this.configRepository.removeTicketType(guildId, name);
        if (guild) await this.updatePanel(guild).catch(() => null);
        return config;
    }

    public async incrementTicketCounter(guildId: string): Promise<number> {
        return this.configRepository.incrementTicketCounter(guildId);
    }

    public async setPanelInfo(guildId: string, channelId: string, messageId: string): Promise<ISupportConfigDocument> {
        return this.configRepository.setPanelInfo(guildId, channelId, messageId);
    }

    public async updatePanel(guild: Guild): Promise<void> {
        const config = await this.getConfig(guild.id);
        if (!config.panelChannelId || !config.panelMessageId) return;

        const channel = guild.channels.cache.get(config.panelChannelId) as TextChannel | undefined;
        if (!channel) return;

        const message = await channel.messages.fetch(config.panelMessageId).catch(() => null);
        if (!message) return;

        if (!config.ticketTypes || config.ticketTypes.length === 0) {
            await message.edit({ components: [] }).catch(() => null);
            return;
        }

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        // Deduplicate ticket types by name (case-insensitive)
        const seenNames = new Set<string>();
        const uniqueTypes = config.ticketTypes.filter(type => {
            const lowerName = type.name.toLowerCase();
            if (seenNames.has(lowerName)) return false;
            seenNames.add(lowerName);
            return true;
        });

        for (const type of uniqueTypes) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }

            let style = ButtonStyle.Primary;
            if (type.color === 'Green') style = ButtonStyle.Success;
            else if (type.color === 'Red') style = ButtonStyle.Danger;
            else if (type.color === 'Grey') style = ButtonStyle.Secondary;

            const button = new ButtonBuilder()
                .setCustomId(`ticket_create_${type.name}`)
                .setLabel(type.name)
                .setStyle(style);

            if (type.emoji) {
                button.setEmoji(type.emoji);
            }

            currentRow.addComponents(button);
        }
        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        await message.edit({ components: rows }).catch(() => null);
    }
}
