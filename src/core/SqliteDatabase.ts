import Database from 'better-sqlite3';
import { injectable, inject } from 'tsyringe';
import { ILogger } from '@/common/utils/logger/ILogger';
import path from 'path';
import fs from 'fs';

@injectable()
export class SqliteDatabase {
    private db: Database.Database;

    constructor(@inject('ILogger') private readonly logger: ILogger) {
        const dbPath = path.resolve(process.cwd(), 'database.sqlite');
        
        try {
            this.db = new Database(dbPath);
            this.logger.info(`Successfully connected to SQLite database at ${dbPath}`);
            this.initializeSchema();
        } catch (error) {
            this.logger.error('Error connecting to SQLite database:', error);
            throw error;
        }
    }

    public get instance(): Database.Database {
        return this.db;
    }

    private initializeSchema(): void {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS user_timezones (
                    userId TEXT PRIMARY KEY,
                    timezone TEXT NOT NULL,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            this.logger.info('SQLite schema initialized (user_timezones table).');
        } catch (error) {
            this.logger.error('Error initializing SQLite schema:', error);
            throw error;
        }
    }
}
