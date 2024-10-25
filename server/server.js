import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import { testConnection, closePool, getPoolStatus } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

import { initWebSocketServer } from './config/websocket.js';

async function startServer() {
  try {
    // Verify database connectivity through connection pool
    const dbInfo = await testConnection();
    const poolStats = getPoolStatus();

    console.log(`[Database Pool] Connected to "${dbInfo.database}" as user "${dbInfo.user}" (${dbInfo.latencyMs}ms latency)`);
    console.log(`[Database Pool] Initialized (total: ${poolStats.totalCount}, idle: ${poolStats.idleCount})`);

    const server = app.listen(PORT, () => {
      console.log(`[Server] University Grading & Registration API running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${NODE_ENV}`);
    });

    // Initialize WebSocket server
    initWebSocketServer(server);

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Draining connection pool and shutting down...`);
      server.close(async () => {
        await closePool();
        console.log('[Server] Graceful shutdown completed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[Server] Failed to connect to database or start server:', err);
    process.exit(1);
  }
}

startServer();
