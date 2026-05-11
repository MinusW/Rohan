import { UserTimezone } from '../models/UserTimezone';

export interface ITimezoneService {
    getUserTimezone(userId: string): Promise<UserTimezone | null>;
    setUserTimezone(userId: string, timezone: string): Promise<void>;
    isValidTimezone(timezone: string): boolean;
    getAllTimezones(): string[];
}
