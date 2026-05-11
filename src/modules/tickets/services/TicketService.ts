import { injectable, inject } from 'tsyringe';
import { Guild, User, TextChannel, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';
import { ITicketService } from '@/modules/tickets/services/ITicketService';
import { ITicketRepository } from '@/modules/tickets/repositories/ITicketRepository';
import { IResolutionEntry, ITicketDocument } from '@/modules/tickets/models/TicketModel';
import { ISupportConfigService } from '@/modules/tickets/services/ISupportConfigService';
import { ILogger } from '@/common/utils/logger/ILogger';

@injectable()
export class TicketService implements ITicketService {
    constructor(
        @inject('ITicketRepository') private readonly ticketRepository: ITicketRepository,
        @inject('ISupportConfigService') private readonly configService: ISupportConfigService,
        @inject('ILogger') private readonly logger: ILogger
    ) { }

    private async updateLogMessage(
        action: 'created' | 'claimed' | 'closed' | 'reopened' | 'deleted' | 'transferred' | 'unclaimed',
        ticket: ITicketDocument | Partial<ITicketDocument>,
        guild: Guild,
        actor?: User,
        summary?: string
    ): Promise<string | undefined> {
        const config = await this.configService.getConfig(guild.id);
        if (!config.logChannelId) return ticket.logMessageId;

        const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
        if (!logChannel) return ticket.logMessageId;

        let logMsg: Message | null = null;
        if (ticket.logMessageId) {
            logMsg = await logChannel.messages.fetch(ticket.logMessageId).catch(() => null);
        }

        const creator = ticket.creatorId ? await guild.client.users.fetch(ticket.creatorId).catch(() => null) : null;
        const claimer = ticket.claimerId ? await guild.client.users.fetch(ticket.claimerId).catch(() => null) : null;

        const logEmbed = new EmbedBuilder()
            .addFields(
                { name: 'Ticket ID', value: ticket.channelId || 'Unknown', inline: true },
                { name: 'Type', value: ticket.ticketType || 'Unknown', inline: true },
                { name: 'Status', value: action === 'deleted' ? 'deleted' : (ticket.status || 'open'), inline: true },
                { name: 'Creator', value: creator ? `${creator.tag} (${creator.id})` : (ticket.creatorId || 'Unknown'), inline: true }
            )
            .setTimestamp();

        if (ticket.claimerId || action === 'claimed') {
            logEmbed.addFields({ name: 'Claimer', value: claimer ? `${claimer.tag} (${claimer.id})` : (ticket.claimerId || 'None'), inline: true });
        }

        if (action === 'created' || action === 'unclaimed') {
            logEmbed.setTitle(action === 'created' ? 'Ticket Created' : 'Ticket Unclaimed (Waiting)').setColor('Green');
        } else if (action === 'claimed') {
            logEmbed.setTitle('Ticket Claimed').setColor('Yellow');
        } else if (action === 'transferred') {
            logEmbed.setTitle('Ticket Transferred').setColor('Purple');
            if (actor) logEmbed.addFields({ name: 'Transferred By', value: `${actor.tag} (${actor.id})`, inline: true });
        } else if (action === 'closed') {
            logEmbed.setTitle('Ticket Closed').setColor('Red');
            if (actor) logEmbed.addFields({ name: 'Closer', value: `${actor.tag} (${actor.id})`, inline: true });
        } else if (action === 'reopened') {
            logEmbed.setTitle('Ticket Reopened').setColor('Green');
            if (actor) logEmbed.addFields({ name: 'Reopened By', value: `${actor.tag} (${actor.id})`, inline: true });
        } else if (action === 'deleted') {
            logEmbed.setTitle('Ticket Deleted').setColor('DarkButNotBlack');
        }

        logEmbed.addFields(
            { name: 'Title', value: (ticket.title || '').substring(0, 1024), inline: false },
            { name: 'Description', value: (ticket.description || '').substring(0, 1024), inline: false }
        );

        if (action !== 'deleted') {
            logEmbed.addFields({ name: 'Link', value: `<#${ticket.channelId}>`, inline: false });
        }

        if (action === 'closed' && summary) {
            logEmbed.addFields({ name: 'Resolution Summary', value: summary.substring(0, 1024), inline: false });
        }

        if (action === 'deleted') {
            let resolutionHistory = 'None';
            if (ticket.resolutions && ticket.resolutions.length > 0) {
                const entries: string[] = [];
                for (let i = 0; i < ticket.resolutions.length; i++) {
                    const r = ticket.resolutions[i];
                    const closerUser = await guild.client.users.fetch(r.closerId).catch(() => null);
                    const closerName = closerUser ? closerUser.tag : r.closerId;
                    const timestamp = `<t:${Math.floor(new Date(r.closedAt).getTime() / 1000)}:f>`;
                    entries.push(`**#${i + 1}** by **${closerName}** at ${timestamp}\n${r.summary}`);
                }
                resolutionHistory = entries.join('\n\n').substring(0, 1024);
            }
            logEmbed.addFields(
                { name: 'Resolution History', value: resolutionHistory, inline: false },
                { name: 'Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            );
        }

        if (logMsg) {
            await logMsg.edit({ embeds: [logEmbed] }).catch(() => null);
            return logMsg.id;
        } else {
            const msg = await logChannel.send({ embeds: [logEmbed] }).catch(err => {
                this.logger.error('Failed to send log:', err);
                return null;
            });
            return msg?.id;
        }
    }

    private async setChannelAccess(channel: TextChannel, userId: string, hasAccess: boolean): Promise<void> {
        try {
            await channel.permissionOverwrites.edit(userId, {
                ViewChannel: hasAccess,
                SendMessages: hasAccess,
                ReadMessageHistory: hasAccess
            });
        } catch (err) {
            this.logger.error(`Failed to update channel permissions for ${userId}:`, err);
        }
    }

    public async createTicketChannel(guild: Guild, creator: User, ticketType: string, title: string, description: string): Promise<TextChannel | null> {
        const config = await this.configService.getConfig(guild.id);
        if (!config.discordCategoryId) {
            this.logger.warn(`No discord category configured for guild ${guild.id}`);
            return null;
        }

        const ticketNumber = await this.configService.incrementTicketCounter(guild.id);
        const ticketId = ticketNumber.toString().padStart(4, '0');
        const channelName = `ticket-${ticketId}-${ticketType.toLowerCase()}`;

        try {
            const overwrites: any[] = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: creator.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (config.supportRoleId && guild.roles.cache.has(config.supportRoleId)) {
                overwrites.push({
                    id: config.supportRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: config.discordCategoryId,
                permissionOverwrites: overwrites
            });

            const partialTicket = {
                channelId: channel.id,
                ticketType,
                status: 'open',
                creatorId: creator.id,
                title,
                description
            };
            const logMessageId = await this.updateLogMessage('created', partialTicket, guild, creator);

            try {
                await this.ticketRepository.create({
                    guildId: guild.id,
                    channelId: channel.id,
                    creatorId: creator.id,
                    ticketType,
                    title,
                    description,
                    status: 'open',
                    logMessageId,
                    ticketNumber
                });
            } catch (dbError) {
                this.logger.error('Failed to save ticket to DB, deleting channel.', dbError);
                await channel.delete('Failed to save ticket to DB').catch(() => null);
                return null;
            }

            const typeConfig = config.ticketTypes.find(t => t.name === ticketType);
            const embedColor = (typeConfig?.color as any) || 'Blue';

            const embed = new EmbedBuilder()
                .setTitle(`Ticket: ${title.substring(0, 250)}`)
                .setDescription(`**Type:** ${ticketType}\n**Creator:** ${creator.toString()}\n\n**Description:**\n${description.substring(0, 1000)}`)
                .setColor(embedColor)
                .setTimestamp();

            const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim Ticket').setStyle(ButtonStyle.Success).setEmoji('✋'),
                new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const supportMention = config.supportRoleId ? `<@&${config.supportRoleId}>` : 'Support';
            await channel.send({ content: `${creator.toString()}, your ticket has been created! ${supportMention} will be with you shortly. Until then feel free to add more information!`, embeds: [embed], components: [actionRow] });
            this.logger.info(`Created ticket channel ${channel.id} for user ${creator.id}`);

            return channel;
        } catch (error) {
            this.logger.error(`Failed to create ticket channel in guild ${guild.id}:`, error);
            return null;
        }
    }

    public async claimTicket(guild: Guild, channelId: string, claimer: User): Promise<boolean> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket || ticket.status === 'claimed') return false;

        ticket.claimerId = claimer.id;
        ticket.status = 'claimed';
        await this.ticketRepository.update(channelId, { claimerId: claimer.id, status: 'claimed' });
        this.logger.info(`Ticket in channel ${channelId} claimed by user ${claimer.id}`);

        await this.updateLogMessage('claimed', ticket, guild, claimer);

        return true;
    }

    public async transferTicket(guild: Guild, channelId: string, transferrer: User, newClaimer: User): Promise<boolean> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket || ticket.status !== 'claimed') return false;

        ticket.claimerId = newClaimer.id;
        await this.ticketRepository.update(channelId, { claimerId: newClaimer.id });
        this.logger.info(`Ticket in channel ${channelId} transferred by ${transferrer.id} to ${newClaimer.id}`);

        await this.updateLogMessage('transferred', ticket, guild, transferrer);

        return true;
    }

    public async unclaimTicket(guild: Guild, channelId: string, unclaimer: User): Promise<boolean> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket || ticket.status !== 'claimed') return false;

        ticket.claimerId = undefined;
        ticket.status = 'open';
        await this.ticketRepository.update(channelId, { claimerId: null, status: 'open' } as any);
        this.logger.info(`Ticket in channel ${channelId} unclaimed by ${unclaimer.id}`);

        await this.updateLogMessage('unclaimed', ticket, guild, unclaimer);

        return true;
    }

    public async closeTicket(guild: Guild, channelId: string, closer: User, summary: string): Promise<{ embed: EmbedBuilder, row: ActionRowBuilder<ButtonBuilder> } | null> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket || ticket.status === 'closed') return null;

        const resolution: IResolutionEntry = { summary, closerId: closer.id, closedAt: new Date() };
        const allResolutions = [...(ticket.resolutions || []), resolution];

        ticket.status = 'closed';
        ticket.resolutions = allResolutions;

        await this.updateLogMessage('closed', ticket, guild, closer, summary);

        const channel = guild.channels.resolve(channelId) as TextChannel | null;
        if (channel) {
            await this.setChannelAccess(channel, ticket.creatorId, false);
        }

        await this.ticketRepository.update(channelId, { status: 'closed', resolutions: allResolutions });
        this.logger.info(`Ticket in channel ${channelId} closed by user ${closer.id}`);

        const closedEmbed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(`This ticket has been closed by ${closer.toString()}.`)
            .addFields(
                { name: 'Resolution Summary', value: summary.substring(0, 1024), inline: false },
                { name: 'Closed At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setColor('Red')
            .setTimestamp();

        const postCloseRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Reopen Ticket').setStyle(ButtonStyle.Success).setEmoji('🔓'),
            new ButtonBuilder().setCustomId('ticket_delete').setLabel('Delete Channel').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
        );

        return { embed: closedEmbed, row: postCloseRow };
    }

    public async reopenTicket(guild: Guild, channelId: string, reopener: User): Promise<boolean> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket || ticket.status !== 'closed') return false;

        const channel = guild.channels.resolve(channelId) as TextChannel | null;
        if (!channel) return false;

        await this.setChannelAccess(channel, ticket.creatorId, true);

        const newStatus = ticket.claimerId ? 'claimed' : 'open';
        ticket.status = newStatus;
        await this.ticketRepository.update(channelId, { status: newStatus });

        await this.updateLogMessage('reopened', ticket, guild, reopener);

        this.logger.info(`Ticket in channel ${channelId} reopened by user ${reopener.id}`);
        return true;
    }

    public async deleteTicketChannel(guild: Guild, channelId: string): Promise<boolean> {
        const ticket = await this.ticketRepository.getByChannelId(channelId);
        if (!ticket) return false;

        await this.updateLogMessage('deleted', ticket, guild);

        const channel = guild.channels.resolve(channelId);
        if (channel) {
            try {
                await channel.delete('Ticket channel deleted by staff');
            } catch (err) {
                this.logger.error('Failed to delete channel:', err);
                return false;
            }
        }

        await this.ticketRepository.delete(channelId);
        this.logger.info(`Ticket channel ${channelId} deleted permanently`);
        return true;
    }
}
