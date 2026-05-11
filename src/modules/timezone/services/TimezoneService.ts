import { injectable, inject } from 'tsyringe';
import { ITimezoneService } from './ITimezoneService';
import { ITimezoneRepository } from '../repositories/ITimezoneRepository';
import { UserTimezone } from '../models/UserTimezone';

@injectable()
export class TimezoneService implements ITimezoneService {
    private readonly validTimezones: string[];

    constructor(
        @inject('ITimezoneRepository') private readonly timezoneRepository: ITimezoneRepository
    ) {
        // Use Intl to get all supported IANA timezones
        this.validTimezones = (Intl as any).supportedValuesOf('timeZone');
    }

    public async getUserTimezone(userId: string): Promise<UserTimezone | null> {
        return this.timezoneRepository.getByUserId(userId);
    }

    public async setUserTimezone(userId: string, timezone: string): Promise<void> {
        if (!this.isValidTimezone(timezone)) {
            throw new Error(`Invalid timezone: ${timezone}`);
        }
        await this.timezoneRepository.save({ userId, timezone });
    }

    public isValidTimezone(timezone: string): boolean {
        return this.validTimezones.includes(timezone);
    }

    public getAllTimezones(): string[] {
        return this.validTimezones;
    }
}
