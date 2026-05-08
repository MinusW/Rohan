import winston from 'winston';
import { injectable } from 'tsyringe';
import { ILogger } from '@/common/utils/logger/ILogger';

@injectable()
export class WinstonLogger implements ILogger {
    private logger: winston.Logger;

    constructor() {
        this.logger = winston.createLogger({
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                winston.format.errors({ stack: true }),
                winston.format.splat(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(
                            ({ level, message, timestamp, stack }) => {
                                if (stack) {
                                    return `[${timestamp}] ${level}: ${message}\n${stack}`;
                                }
                                return `[${timestamp}] ${level}: ${message}`;
                            }
                        )
                    )
                })
            ]
        });
    }

    public info(message: string, meta?: any): void {
        this.logger.info(message, meta);
    }

    public warn(message: string, meta?: any): void {
        this.logger.warn(message, meta);
    }

    public error(message: string, meta?: any): void {
        this.logger.error(message, meta);
    }

    public debug(message: string, meta?: any): void {
        this.logger.debug(message, meta);
    }
}
