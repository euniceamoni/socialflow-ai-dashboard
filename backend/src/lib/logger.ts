import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProduction
    ? winston.format.json() // JSON format for production (cloud-ready)
    : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, scope, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${scope || 'app'}] ${level}: ${message}${metaStr}`;
      })
    ),
  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
      ]
      : []),
  ],
});

export interface Logger {
  info: (message: string, metadata?: unknown) => void;
  warn: (message: string, metadata?: unknown) => void;
  error: (message: string, metadata?: unknown) => void;
}

export const createLogger = (scope: string): Logger => {
  return {
    info: (message, metadata) => {
      winstonLogger.info(message, { scope, ...metadata });
    },
    warn: (message, metadata) => {
      winstonLogger.warn(message, { scope, ...metadata });
    },
    error: (message, metadata) => {
      winstonLogger.error(message, { scope, ...metadata });
    },
  };
};