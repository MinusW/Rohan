import { injectable, inject } from 'tsyringe';
import { Guild, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ThreadAutoArchiveDuration } from 'discord.js';
import { IScrimService } from '@/modules/scrims/services/IScrimService';
import { IScrimRepository } from '@/modules/scrims/repositories/IScrimRepository';
import { IScrimConfigService } from '@/modules/scrims/services/IScrimConfigService';
import { IScrimDocument, ScrimStatus } from '@/modules/scrims/models/ScrimModel';
import { ILogger } from '@/common/utils/logger/ILogger';

@injectable()
export class ScrimService implements IScrimService {
    constructor(
        @inject('IScrimRepository') private readonly scrimRepository: IScrimRepository,
        @inject('IScrimConfigService') private readonly configService: IScrimConfigService,
        @inject('ILogger') private readonly logger: ILogger
    ) {}

    /** Maps a ScrimStatus to its embed color. */
    private getStatusColor(status: ScrimStatus): number {
        switch (status) {
            case ScrimStatus.Open: return 0x57F287;
            case ScrimStatus.Applied: return 0xFEE75C;
            case ScrimStatus.Confirmed: return 0x9B59B6;
            case ScrimStatus.Concluded: return 0x3498DB;
            case ScrimStatus.Cancelled: return 0xED4245;
            case ScrimStatus.Expired: return 0x95A5A6;
            default: return 0x2B2D31;
        }
    }

    /** Builds the embed for a scrim request. */
    private async buildScrimEmbed(scrim: IScrimDocument, guild: Guild): Promise<EmbedBuilder> {
        const creator = await guild.client.users.fetch(scrim.creatorId).catch(() => null);
        const unixTime = Math.floor(scrim.scheduledAt.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`Scrim Request — ${scrim.tier}`)
            .setColor(this.getStatusColor(scrim.status as ScrimStatus))
            .addFields(
                { name: 'Date & Time', value: `<t:${unixTime}:F> (<t:${unixTime}:R>)`, inline: false },
                { name: 'Tier', value: scrim.tier, inline: true },
                { name: 'Matches', value: scrim.matchCount.toString(), inline: true },
                { name: 'Organizer', value: creator ? creator.toString() : `<@${scrim.creatorId}>`, inline: true }
            );

        if (scrim.extraInfo) {
            embed.addFields({ name: 'Extra Info', value: scrim.extraInfo.substring(0, 1024), inline: false });
        }

        // Applicant list
        const activeApplicants = scrim.applicants.filter(a => a.status !== 'declined');
        if (activeApplicants.length > 0) {
            const applicantLines = activeApplicants.map(a => {
                const statusLabel = a.status === 'accepted' ? 'Accepted' : 'Pending';
                const statusIcon = a.status === 'accepted' ? '✓' : '○';
                return `${statusIcon} <@${a.userId}> — ${statusLabel}`;
            });
            embed.addFields({ name: `Applicants (${activeApplicants.length})`, value: applicantLines.join('\n').substring(0, 1024), inline: false });
        }

        // Status label
        const statusLabels: Record<string, string> = {
            [ScrimStatus.Open]: 'Open',
            [ScrimStatus.Applied]: 'Pending Applications',
            [ScrimStatus.Confirmed]: 'Confirmed',
            [ScrimStatus.Concluded]: 'Concluded',
            [ScrimStatus.Cancelled]: 'Cancelled',
            [ScrimStatus.Expired]: 'Expired'
        };
        embed.setFooter({ text: `Status: ${statusLabels[scrim.status] || scrim.status}` });
        embed.setTimestamp(scrim.createdAt);

        return embed;
    }

    /** Builds the action row buttons for a scrim message. */
    private buildScrimButtons(scrim: IScrimDocument, userId?: string): ActionRowBuilder<ButtonBuilder>[] {
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        const scrimId = scrim._id.toString();

        if (scrim.status === ScrimStatus.Open || scrim.status === ScrimStatus.Applied) {
            const row = new ActionRowBuilder<ButtonBuilder>();

            // Check if the viewing user has already applied
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`scrim_apply_${scrimId}`)
                    .setLabel('Apply')
                    .setStyle(ButtonStyle.Success)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`scrim_withdraw_${scrimId}`)
                    .setLabel('Withdraw')
                    .setStyle(ButtonStyle.Secondary)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`scrim_cancel_${scrimId}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

            rows.push(row);
        } else if (scrim.status === ScrimStatus.Confirmed) {
            const row = new ActionRowBuilder<ButtonBuilder>();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`scrim_conclude_${scrimId}`)
                    .setLabel('Conclude')
                    .setStyle(ButtonStyle.Success)
            );

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`scrim_cancel_${scrimId}`)
                    .setLabel('Cancel Scrim')
                    .setStyle(ButtonStyle.Danger)
            );

            rows.push(row);
        }

        return rows;
    }

    /** Computes the correct status based on applicant state. */
    private computeStatus(scrim: IScrimDocument): ScrimStatus {
        const hasAccepted = scrim.applicants.some(a => a.status === 'accepted');
        if (hasAccepted) return ScrimStatus.Confirmed;

        const hasPending = scrim.applicants.some(a => a.status === 'pending');
        if (hasPending) return ScrimStatus.Applied;

        return ScrimStatus.Open;
    }

    public async createScrim(
        guild: Guild,
        channelId: string,
        creatorId: string,
        scheduledAt: Date,
        tier: string,
        matchCount: number,
        extraInfo?: string
    ): Promise<IScrimDocument | null> {
        const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel) return null;

        try {
            // Limit active scrims to 5 per player
            const activeCount = await this.scrimRepository.countActiveByUser(guild.id, creatorId);
            if (activeCount >= 5) {
                this.logger.warn(`User ${creatorId} reached active scrim limit (5)`);
                return null;
            }

            // Create a temporary scrim to build the embed
            const tempScrim = {
                _id: 'temp',
                guildId: guild.id,
                channelId,
                messageId: '',
                threadId: '',
                creatorId,
                scheduledAt,
                tier,
                matchCount,
                extraInfo,
                status: ScrimStatus.Open,
                applicants: [],
                applicantMessageIds: new Map(),
                notifiedStart: false,
                createdAt: new Date()
            } as any;

            const embed = await this.buildScrimEmbed(tempScrim, guild);
            const buttons = this.buildScrimButtons(tempScrim);

            // Send the scrim message
            const message = await channel.send({ embeds: [embed], components: buttons });

            // Create a thread under the message
            const thread = await message.startThread({
                name: `${tier} Scrim — ${guild.members.cache.get(creatorId)?.user.username || creatorId}`.substring(0, 100),
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek
            });

            await thread.send(`Scrim discussion thread created by <@${creatorId}>. Applicants will be notified here.`);

            // Save to database
            const scrim = await this.scrimRepository.create({
                guildId: guild.id,
                channelId,
                messageId: message.id,
                threadId: thread.id,
                creatorId,
                scheduledAt,
                tier,
                matchCount,
                extraInfo,
                status: ScrimStatus.Open,
                applicantMessageIds: new Map(),
                notifiedStart: false
            });

            // Re-edit the message with correct scrim ID in button custom IDs
            const realButtons = this.buildScrimButtons(scrim);
            const realEmbed = await this.buildScrimEmbed(scrim, guild);
            await message.edit({ embeds: [realEmbed], components: realButtons }).catch(() => null);

            // Refresh the panel to push it to the bottom
            await this.configService.updatePanel(guild, channelId);

            this.logger.info(`Scrim ${scrim._id} created in channel ${channelId} by ${creatorId}`);
            return scrim;
        } catch (error) {
            this.logger.error('Failed to create scrim:', error);
            return null;
        }
    }

    public async applyToScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;
        if (scrim.status === ScrimStatus.Cancelled || scrim.status === ScrimStatus.Expired) return false;
        if (scrim.creatorId === userId) return false;

        // Check if already applied (and not declined)
        const existingApp = scrim.applicants.find(a => a.userId === userId && a.status !== 'declined');
        if (existingApp) return false;

        // Check if someone is already accepted
        const hasAccepted = scrim.applicants.some(a => a.status === 'accepted');
        if (hasAccepted) return false;

        // Add the applicant
        scrim.applicants.push({ userId, appliedAt: new Date(), status: 'pending' });
        scrim.status = this.computeStatus(scrim);

        await this.scrimRepository.update(scrimId, {
            applicants: scrim.applicants,
            status: scrim.status
        });

        // Update the embed
        await this.updateScrimEmbed(guild, scrim);

        // Post in thread with accept/decline buttons for the creator
        try {
            const thread = guild.channels.cache.get(scrim.threadId);
            if (thread?.isThread()) {
                const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`scrim_accept_${scrimId}_${userId}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`scrim_decline_${scrimId}_${userId}`)
                        .setLabel('Decline')
                        .setStyle(ButtonStyle.Danger)
                );

                const appMsg = await thread.send({
                    content: `<@${scrim.creatorId}>, <@${userId}> has applied to your scrim.`,
                    components: [actionRow]
                });

                // Store message ID for withdrawal cleanup
                if (scrim.applicantMessageIds instanceof Map) {
                    scrim.applicantMessageIds.set(userId, appMsg.id);
                } else {
                    (scrim as any).applicantMessageIds = new Map([[userId, appMsg.id]]);
                }
                
                await this.scrimRepository.update(scrimId, {
                    applicantMessageIds: scrim.applicantMessageIds
                });
            }
        } catch {
            // Thread may be archived or deleted
        }

        this.logger.info(`User ${userId} applied to scrim ${scrimId}`);
        return true;
    }

    public async withdrawApplication(guild: Guild, scrimId: string, userId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;

        const applicantIndex = scrim.applicants.findIndex(a => a.userId === userId && a.status !== 'declined');
        if (applicantIndex === -1) return false;

        const wasAccepted = scrim.applicants[applicantIndex].status === 'accepted';
        scrim.applicants.splice(applicantIndex, 1);
        scrim.status = this.computeStatus(scrim);

        await this.scrimRepository.update(scrimId, {
            applicants: scrim.applicants,
            status: scrim.status
        });

        await this.updateScrimEmbed(guild, scrim);

        // Notify in thread and cleanup application message
        try {
            const thread = guild.channels.cache.get(scrim.threadId);
            if (thread?.isThread()) {
                // Delete the original application message if we have its ID
                const appMsgId = scrim.applicantMessageIds instanceof Map 
                    ? scrim.applicantMessageIds.get(userId) 
                    : (scrim.applicantMessageIds as any)?.[userId];
                if (appMsgId) {
                    const appMsg = await thread.messages.fetch(appMsgId).catch(() => null);
                    if (appMsg) await appMsg.delete().catch(() => null);
                    
                    if (scrim.applicantMessageIds instanceof Map) {
                        scrim.applicantMessageIds.delete(userId);
                    } else {
                        delete (scrim.applicantMessageIds as any)[userId];
                    }

                    await this.scrimRepository.update(scrimId, {
                        applicantMessageIds: scrim.applicantMessageIds
                    });
                }

                const message = wasAccepted
                    ? `<@${scrim.creatorId}>, <@${userId}> has pulled out of the scrim. The scrim is now open again.`
                    : `<@${userId}> has withdrawn their application.`;
                await thread.send(message);
            }
        } catch {
            // Thread may be archived or deleted
        }

        this.logger.info(`User ${userId} withdrew from scrim ${scrimId}`);
        return true;
    }

    public async acceptApplicant(guild: Guild, scrimId: string, creatorId: string, applicantId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;
        if (scrim.creatorId !== creatorId) return false;

        // Check no one is already accepted
        const alreadyAccepted = scrim.applicants.some(a => a.status === 'accepted');
        if (alreadyAccepted) return false;

        const applicant = scrim.applicants.find(a => a.userId === applicantId && a.status === 'pending');
        if (!applicant) return false;

        applicant.status = 'accepted';
        scrim.status = ScrimStatus.Confirmed;

        await this.scrimRepository.update(scrimId, {
            applicants: scrim.applicants,
            status: scrim.status
        });

        await this.updateScrimEmbed(guild, scrim);

        // Notify in thread and cleanup application message
        try {
            const thread = guild.channels.cache.get(scrim.threadId);
            if (thread?.isThread()) {
                // Delete the original application message
                const appMsgId = scrim.applicantMessageIds instanceof Map 
                    ? scrim.applicantMessageIds.get(applicantId) 
                    : (scrim.applicantMessageIds as any)?.[applicantId];
                
                if (appMsgId) {
                    const appMsg = await thread.messages.fetch(appMsgId).catch(() => null);
                    if (appMsg) await appMsg.delete().catch(() => null);
                    
                    if (scrim.applicantMessageIds instanceof Map) {
                        scrim.applicantMessageIds.delete(applicantId);
                    } else {
                        delete (scrim.applicantMessageIds as any)[applicantId];
                    }

                    await this.scrimRepository.update(scrimId, {
                        applicantMessageIds: scrim.applicantMessageIds
                    });
                }

                await thread.send(`<@${applicantId}>, your application has been accepted by <@${creatorId}>. The scrim is confirmed!`);
            }
        } catch {
            // Thread may be archived or deleted
        }

        this.logger.info(`Scrim ${scrimId}: creator ${creatorId} accepted applicant ${applicantId}`);
        return true;
    }

    public async declineApplicant(guild: Guild, scrimId: string, creatorId: string, applicantId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;
        if (scrim.creatorId !== creatorId) return false;

        const applicant = scrim.applicants.find(a => a.userId === applicantId && a.status === 'pending');
        if (!applicant) return false;

        applicant.status = 'declined';
        scrim.status = this.computeStatus(scrim);

        await this.scrimRepository.update(scrimId, {
            applicants: scrim.applicants,
            status: scrim.status
        });

        await this.updateScrimEmbed(guild, scrim);

        // Notify in thread
        try {
            const thread = guild.channels.cache.get(scrim.threadId);
            if (thread?.isThread()) {
                await thread.send(`<@${applicantId}>, your application has been declined.`);
            }
        } catch {
            // Thread may be archived or deleted
        }

        this.logger.info(`Scrim ${scrimId}: creator ${creatorId} declined applicant ${applicantId}`);
        return true;
    }

    public async cancelScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;
        if (scrim.status === ScrimStatus.Cancelled || scrim.status === ScrimStatus.Expired) return false;

        // Only the creator or an accepted applicant can cancel
        const isCreator = scrim.creatorId === userId;
        const isAcceptedApplicant = scrim.applicants.some(a => a.userId === userId && a.status === 'accepted');
        
        // Allow creators, accepted applicants, or admins (ManageGuild)
        const member = await guild.members.fetch(userId).catch(() => null);
        const isAdmin = member?.permissions.has('ManageGuild');

        if (!isCreator && !isAcceptedApplicant && !isAdmin) return false;

        scrim.status = ScrimStatus.Cancelled;

        // Log before deleting
        await this.logScrim(guild, scrim, userId);

        // Delete message and thread
        await this.deleteScrimMessages(guild, scrim);

        // Remove from database
        await this.scrimRepository.delete(scrimId);

        // Refresh panel
        await this.configService.updatePanel(guild, scrim.channelId).catch(() => null);

        this.logger.info(`Scrim ${scrimId} cancelled by ${userId}`);
        return true;
    }

    public async concludeScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean> {
        const scrim = await this.scrimRepository.getById(scrimId);
        if (!scrim) return false;
        if (scrim.status !== ScrimStatus.Confirmed) return false;

        // Only the creator or the accepted applicant can conclude
        const isCreator = scrim.creatorId === userId;
        const isAcceptedApplicant = scrim.applicants.some(a => a.userId === userId && a.status === 'accepted');
        if (!isCreator && !isAcceptedApplicant) return false;

        scrim.status = ScrimStatus.Concluded;

        // Log the conclusion
        await this.logScrim(guild, scrim, undefined, userId);

        // Archive messages/thread
        await this.deleteScrimMessages(guild, scrim);

        // Remove from database
        await this.scrimRepository.delete(scrimId);

        // Refresh panel
        await this.configService.updatePanel(guild, scrim.channelId).catch(() => null);

        this.logger.info(`Scrim ${scrimId} concluded by ${userId}`);
        return true;
    }

    public async notifyScrimStarts(client: Client): Promise<void> {
        const toNotify = await this.scrimRepository.getScrimsToNotify();
        if (toNotify.length === 0) return;

        for (const scrim of toNotify) {
            try {
                const guild = client.guilds.cache.get(scrim.guildId);
                if (!guild) continue;

                const config = await this.configService.getConfig(guild.id);
                if (!config.scheduleChannelId) continue;

                const scheduleChannel = guild.channels.cache.get(config.scheduleChannelId) as TextChannel | undefined;
                if (!scheduleChannel) continue;

                const creator = await guild.client.users.fetch(scrim.creatorId).catch(() => null);
                const acceptedApp = scrim.applicants.find(a => a.status === 'accepted');
                const opponent = acceptedApp ? await guild.client.users.fetch(acceptedApp.userId).catch(() => null) : null;

                const embed = new EmbedBuilder()
                    .setTitle('🚀 Scrim Starting Now!')
                    .setDescription(`The scheduled scrim for **${scrim.tier}** is starting.`)
                    .addFields(
                        { name: 'Organizer', value: creator ? creator.toString() : `<@${scrim.creatorId}>`, inline: true },
                        { name: 'Opponent', value: opponent ? opponent.toString() : 'None', inline: true },
                        { name: 'Matches', value: scrim.matchCount.toString(), inline: true }
                    )
                    .setColor(0x3498DB)
                    .setTimestamp();

                await scheduleChannel.send({
                    content: `🔔 <@${scrim.creatorId}> ${opponent ? `and <@${opponent.id}>` : ''}, your scrim is starting!`,
                    embeds: [embed]
                });

                await this.scrimRepository.update(scrim._id.toString(), { notifiedStart: true });
            } catch (error) {
                this.logger.error(`Failed to notify start for scrim ${scrim._id}:`, error);
            }
        }
    }

    public async cleanupExpiredScrims(client: Client): Promise<void> {
        const expiredScrims = await this.scrimRepository.getExpired();
        if (expiredScrims.length === 0) return;

        this.logger.info(`Found ${expiredScrims.length} expired scrim(s) to clean up.`);

        const channelsToRefresh = new Set<{ guildId: string; channelId: string }>();

        for (const scrim of expiredScrims) {
            try {
                const guild = client.guilds.cache.get(scrim.guildId);
                if (!guild) {
                    await this.scrimRepository.delete(scrim._id.toString());
                    continue;
                }

                scrim.status = ScrimStatus.Expired;
                await this.logScrim(guild, scrim);
                await this.deleteScrimMessages(guild, scrim);

                channelsToRefresh.add({ guildId: scrim.guildId, channelId: scrim.channelId });
            } catch (error) {
                this.logger.error(`Failed to cleanup expired scrim ${scrim._id}:`, error);
            }
        }

        // Bulk delete
        await this.scrimRepository.deleteMany(expiredScrims.map(s => s._id.toString()));

        // Refresh panels for affected channels
        for (const { guildId, channelId } of channelsToRefresh) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                await this.configService.updatePanel(guild, channelId).catch(() => null);
            }
        }
    }

    public async updateScrimEmbed(guild: Guild, scrim: IScrimDocument): Promise<void> {
        try {
            const channel = guild.channels.cache.get(scrim.channelId) as TextChannel | undefined;
            if (!channel) return;

            const message = await channel.messages.fetch(scrim.messageId).catch(() => null);
            if (!message) return;

            const embed = await this.buildScrimEmbed(scrim, guild);
            const buttons = this.buildScrimButtons(scrim);

            await message.edit({ embeds: [embed], components: buttons });
        } catch (error) {
            this.logger.error(`Failed to update scrim embed for ${scrim._id}:`, error);
        }
    }

    /** Sends a log embed to the configured log channel. */
    private async logScrim(guild: Guild, scrim: IScrimDocument, cancelledBy?: string, concludedBy?: string): Promise<void> {
        const config = await this.configService.getConfig(guild.id);
        if (!config.logChannelId) return;

        const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
        if (!logChannel) return;

        const creator = await guild.client.users.fetch(scrim.creatorId).catch(() => null);
        const unixTime = Math.floor(scrim.scheduledAt.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`Scrim Archived — ${scrim.tier}`)
            .setColor(this.getStatusColor(scrim.status as ScrimStatus))
            .addFields(
                { name: 'Organizer', value: creator ? `${creator.tag} (${creator.id})` : scrim.creatorId, inline: true },
                { name: 'Tier', value: scrim.tier, inline: true },
                { name: 'Matches', value: scrim.matchCount.toString(), inline: true },
                { name: 'Scheduled For', value: `<t:${unixTime}:F>`, inline: false },
                { name: 'Status', value: scrim.status.toUpperCase(), inline: true },
                { name: 'Created At', value: `<t:${Math.floor(scrim.createdAt.getTime() / 1000)}:F>`, inline: true }
            )
            .setTimestamp();

        if (concludedBy) {
            embed.addFields({ name: 'Concluded By', value: `<@${concludedBy}>`, inline: true });
        }

        if (scrim.extraInfo) {
            embed.addFields({ name: 'Extra Info', value: scrim.extraInfo.substring(0, 1024), inline: false });
        }

        // Applicant summary
        if (scrim.applicants.length > 0) {
            const lines: string[] = [];
            for (const a of scrim.applicants) {
                const user = await guild.client.users.fetch(a.userId).catch(() => null);
                const name = user ? user.tag : a.userId;
                lines.push(`${name} — ${a.status}`);
            }
            embed.addFields({ name: 'Applicants', value: lines.join('\n').substring(0, 1024), inline: false });
        }

        if (cancelledBy) {
            embed.addFields({ name: 'Cancelled By', value: `<@${cancelledBy}>`, inline: true });
        }

        await logChannel.send({ embeds: [embed] }).catch(err => {
            this.logger.error('Failed to log scrim:', err);
        });
    }

    /** Deletes the scrim message and thread from Discord. */
    private async deleteScrimMessages(guild: Guild, scrim: IScrimDocument): Promise<void> {
        try {
            const channel = guild.channels.cache.get(scrim.channelId) as TextChannel | undefined;
            if (!channel) return;

            // Delete thread first
            const thread = guild.channels.cache.get(scrim.threadId);
            if (thread?.isThread()) {
                await thread.delete('Scrim archived').catch(() => null);
            }

            // Delete message
            const message = await channel.messages.fetch(scrim.messageId).catch(() => null);
            if (message) {
                await message.delete().catch(() => null);
            }
        } catch (error) {
            this.logger.error(`Failed to delete scrim messages for ${scrim._id}:`, error);
        }
    }
}
