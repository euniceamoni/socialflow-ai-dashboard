import dotenv from 'dotenv';
import { createServer } from 'http';
import app from './app';
import { SocketService } from './services/SocketService';
import { initializeWorkers } from './jobs/workers';
import { queueManager } from './queues/queueManager';

dotenv.config();

const PORT = process.env.BACKEND_PORT || 3001;

const httpServer = createServer(app);

// Initialize Socket.io and its logic
const socketService = SocketService.getInstance();
socketService.initialize(httpServer);

// Initialize job queue workers
console.log('Initializing job queue workers...');
initializeWorkers();

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('Received shutdown signal. Closing queues and workers...');
  try {
    await queueManager.closeAll();
    console.log('All queues and workers closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

httpServer.listen(PORT, () => {
  console.log(`🚀 SocialFlow Backend is running on http://localhost:${PORT}`);
  console.log('📬 Job Queue System initialized');
});
