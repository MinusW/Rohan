import mongoose from 'mongoose';
import { container } from 'tsyringe';
import { ILogger } from '@/common/utils/logger/ILogger';

export class Database {
    public static async connect(): Promise<void> {
        const logger = container.resolve<ILogger>('ILogger');
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            logger.warn('MONGODB_URI is not defined in the environment variables. Database connection skipped.');
            return;
        }

        try {
            await mongoose.connect(uri);
            logger.info('Successfully connected to MongoDB.');
        } catch (error) {
            logger.error('Error connecting to MongoDB:', error);
            throw error;
        }
    }
}
