import { injectable, inject } from 'tsyringe';
import { ITimezoneRepository } from './ITimezoneRepository';
import { UserTimezone } from '../models/UserTimezone';
import { SqliteDatabase } from '@/core/SqliteDatabase';

@injectable()
export class SqliteTimezoneRepository implements ITimezoneRepository {
    constructor(
        @inject(SqliteDatabase) private readonly db: SqliteDatabase
    ) {}

    public async getByUserId(userId: string): Promise<UserTimezone | null> {
        const stmt = this.db.instance.prepare('SELECT * FROM user_timezones WHERE userId = ?');
        const row = stmt.get(userId) as any;
        
        if (!row) return null;

        return {
            userId: row.userId,
            timezone: row.timezone,
            updatedAt: new Date(row.updatedAt)
        };
    }

    public async save(userTimezone: UserTimezone): Promise<void> {
        const stmt = this.db.instance.prepare(`
            INSERT INTO user_timezones (userId, timezone, updatedAt)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(userId) DO UPDATE SET
                timezone = excluded.timezone,
                updatedAt = CURRENT_TIMESTAMP
        `);
        
        stmt.run(userTimezone.userId, userTimezone.timezone);
    }

    public async delete(userId: string): Promise<void> {
        const stmt = this.db.instance.prepare('DELETE FROM user_timezones WHERE userId = ?');
        stmt.run(userId);
    }
}
