import app from './app';
import { getBackendPort } from './config/runtime';
import { startDataPruningJob, stopDataPruningJob } from './jobs/dataPruningJob';
import { startWorkerMonitor, stopWorkerMonitor } from './monitoring/workerMonitorInstance';
import { createLogger } from './lib/logger';

const logger = createLogger('server');
const PORT = getBackendPort();

const bootstrap = async (): Promise<void> => {
  try {
    await startWorkerMonitor();
  } catch (error) {
    logger.error(
      `Failed to start monitor: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    await startDataPruningJob();
  } catch (error) {
    logger.error(
      `Failed to start scheduler: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 SocialFlow Backend is running on http://localhost:${PORT}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await stopWorkerMonitor();
    } catch (error) {
      logger.error(
        `Failed to stop monitor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      await stopDataPruningJob();
    } catch (error) {
      logger.error(
        `Failed to stop scheduler: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    server.close(() => {
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
};

void bootstrap();
