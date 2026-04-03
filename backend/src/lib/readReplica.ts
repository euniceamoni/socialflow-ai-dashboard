/**
 * Read/write splitting — disabled in Prisma v7 (middleware API removed).
 * Configure DATABASE_REPLICA_URLS when a Prisma v7-compatible adapter is available.
 */
import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger';

const logger = createLogger('readReplica');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function applyReadWriteSplitting(_primary: PrismaClient): void {
  if (process.env.DATABASE_REPLICA_URLS) {
    logger.warn('DATABASE_REPLICA_URLS is set but read/write splitting is not active in Prisma v7');
  }
}
