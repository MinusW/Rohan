import { UserTimezone } from '../models/UserTimezone';

export interface ITimezoneRepository {
    getByUserId(userId: string): Promise<UserTimezone | null>;
    save(userTimezone: UserTimezone): Promise<void>;
    delete(userId: string): Promise<void>;
}
