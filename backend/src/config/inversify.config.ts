import 'reflect-metadata';
import { Container } from 'inversify';
import { createLogger } from '../lib/logger';
import { HealthService } from '../services/healthService';
import { HealthMonitor } from '../services/healthMonitor';
import { NotificationManager } from '../services/notificationProvider';
import { AlertConfigService } from '../services/alertConfigService';

export { TYPES } from './types';
import { TYPES } from './types';

const logger = createLogger('inversify');

const container = new Container();

container.bind<AlertConfigService>(TYPES.AlertConfigService).to(AlertConfigService).inSingletonScope();
container.bind<NotificationManager>(TYPES.NotificationManager).to(NotificationManager).inSingletonScope();
container.bind<HealthMonitor>(TYPES.HealthMonitor).to(HealthMonitor).inSingletonScope();
container.bind<HealthService>(TYPES.HealthService).to(HealthService).inSingletonScope();

logger.info('DI container configured');

export { container };
