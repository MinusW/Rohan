import { injectable, inject } from 'tsyringe';
import { Guild, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { IScrimConfigService } from '@/modules/scrims/services/IScrimConfigService';
import { IScrimConfigRepository } from '@/modules/scrims/repositories/IScrimConfigRepository';
import { IScrimConfigDocument } from '@/modules/scrims/models/ScrimConfigModel';
import { ILogger } from '@/common/utils/logger/ILogger';

@injectable()
export class ScrimConfigService implements IScrimConfigService {
    constructor(
        @inject('IScrimConfigRepository') private readonly configRepository: IScrimConfigRepository,
        @inject('ILogger') private readonly logger: ILogger
    ) {}

    public async getConfig(guildId: string): Promise<IScrimConfigDocument> {
        return this.configRepository.getOrCreateConfig(guildId);
    }

    public async addScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        this.logger.info(`Adding scrim channel ${channelId} for guild ${guildId}`);
        return this.configRepository.addScrimChannel(guildId, channelId);
    }

    public async removeScrimChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        this.logger.info(`Removing scrim channel ${channelId} for guild ${guildId}`);
        return this.configRepository.removeScrimChannel(guildId, channelId);
    }

    public async setLogChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        this.logger.info(`Setting scrim log channel for guild ${guildId} to ${channelId}`);
        return this.configRepository.setLogChannel(guildId, channelId);
    }

    public async setScheduleChannel(guildId: string, channelId: string): Promise<IScrimConfigDocument> {
        this.logger.info(`Setting scrim schedule channel for guild ${guildId} to ${channelId}`);
        return this.configRepository.setScheduleChannel(guildId, channelId);
    }

    public async addTier(guildId: string, name: string, description: string, guild?: Guild): Promise<IScrimConfigDocument> {
        this.logger.info(`Adding scrim tier "${name}" for guild ${guildId}`);
        const config = await this.configRepository.addTier(guildId, { name, description });
        if (guild) await this.updateAllPanels(guild).catch(() => null);
        return config;
    }

    public async removeTier(guildId: string, tierName: string, guild?: Guild): Promise<IScrimConfigDocument> {
        this.logger.info(`Removing scrim tier "${tierName}" for guild ${guildId}`);
        const config = await this.configRepository.removeTier(guildId, tierName);
        if (guild) await this.updateAllPanels(guild).catch(() => null);
        return config;
    }

    public async updatePanel(guild: Guild, channelId: string): Promise<void> {
        const config = await this.getConfig(guild.id);

        const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel) return;

        // Delete old panel message
        const oldMessageId = config.panelMessageIds.get(channelId);
        if (oldMessageId) {
            const oldMsg = await channel.messages.fetch(oldMessageId).catch(() => null);
            if (oldMsg) await oldMsg.delete().catch(() => null);
        }

        // Build panel embed
        const embed = new EmbedBuilder()
            .setTitle('Scrim Finder')
            .setDescription(
                'Looking for a scrim? Click the button matching your desired tier to create a new scrim request.\n\n' +
                'Your request will be visible to everyone in this channel. Other teams can apply, and you can accept or decline.'
            )
            .setColor(0x2B2D31)
            .setFooter({ text: 'TicketLock — Scrims' })
            .setTimestamp();

        if (!config.tiers || config.tiers.length === 0) {
            embed.addFields({ name: 'No Tiers Configured', value: 'An administrator needs to add scrim tiers first.' });
            const msg = await channel.send({ embeds: [embed] }).catch(err => {
                this.logger.error('Failed to send scrim panel:', err);
                return null;
            });
            if (msg) await this.configRepository.setPanelMessageId(guild.id, channelId, msg.id);
            return;
        }

        // Deduplicate tiers by name to prevent duplicate custom IDs
        const seen = new Set<string>();
        const uniqueTiers = config.tiers.filter(t => {
            const key = t.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Add tier info to embed
        const tierList = uniqueTiers.map(t => `**${t.name}** — ${t.description}`).join('\n');
        embed.addFields({ name: 'Available Tiers', value: tierList });

        // Build tier buttons
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (const tier of uniqueTiers) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }

            const button = new ButtonBuilder()
                .setCustomId(`scrim_create_${tier.name}`)
                .setLabel(tier.name)
                .setStyle(ButtonStyle.Primary);

            currentRow.addComponents(button);
        }
        if (currentRow.components.length > 0) rows.push(currentRow);

        const msg = await channel.send({ embeds: [embed], components: rows }).catch(err => {
            this.logger.error('Failed to send scrim panel:', err);
            return null;
        });

        if (msg) {
            await this.configRepository.setPanelMessageId(guild.id, channelId, msg.id);
        }
    }

    public async updateAllPanels(guild: Guild): Promise<void> {
        const config = await this.getConfig(guild.id);
        for (const channelId of config.scrimChannelIds) {
            await this.updatePanel(guild, channelId).catch(() => null);
        }
    }
}
