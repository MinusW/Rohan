import { IScrimDocument } from '@/modules/scrims/models/ScrimModel';

export interface IScrimRepository {
    create(data: Partial<IScrimDocument>): Promise<IScrimDocument>;
    getById(scrimId: string): Promise<IScrimDocument | null>;
    getByMessageId(messageId: string): Promise<IScrimDocument | null>;
    getActiveByChannel(channelId: string): Promise<IScrimDocument[]>;
    update(scrimId: string, data: Partial<IScrimDocument>): Promise<IScrimDocument | null>;
    delete(scrimId: string): Promise<void>;
    getExpired(): Promise<IScrimDocument[]>;
    getScrimsToNotify(): Promise<IScrimDocument[]>;
    countActiveByUser(guildId: string, userId: string): Promise<number>;
    deleteMany(scrimIds: string[]): Promise<void>;
}
