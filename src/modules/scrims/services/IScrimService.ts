import { Guild } from 'discord.js';
import { IScrimDocument } from '@/modules/scrims/models/ScrimModel';
import { Client } from 'discord.js';

export interface IScrimService {
    createScrim(
        guild: Guild,
        channelId: string,
        creatorId: string,
        scheduledAt: Date,
        tier: string,
        matchCount: number,
        extraInfo?: string
    ): Promise<IScrimDocument | null>;

    applyToScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean>;
    withdrawApplication(guild: Guild, scrimId: string, userId: string): Promise<boolean>;
    acceptApplicant(guild: Guild, scrimId: string, creatorId: string, applicantId: string): Promise<boolean>;
    declineApplicant(guild: Guild, scrimId: string, creatorId: string, applicantId: string): Promise<boolean>;
    cancelScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean>;
    concludeScrim(guild: Guild, scrimId: string, userId: string): Promise<boolean>;
    cleanupExpiredScrims(client: Client): Promise<void>;
    notifyScrimStarts(client: Client): Promise<void>;
    updateScrimEmbed(guild: Guild, scrim: IScrimDocument): Promise<void>;
}
