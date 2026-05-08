import mongoose from 'mongoose';

export class Database {
    public static async connect(): Promise<void> {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.warn('MONGODB_URI is not defined in the environment variables. Database connection skipped.');
            return;
        }

        try {
            await mongoose.connect(uri);
            console.log('Successfully connected to MongoDB.');
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
            throw error;
        }
    }
}
