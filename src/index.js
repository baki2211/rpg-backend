import dotenv from 'dotenv';
dotenv.config();

import http from 'http';

import { createApp } from './app.js';
import { setupWebSocketServer } from './websockets/ChatWebSocket.js';
import { createUpgradeHandler } from './websockets/upgradeHandler.js';
import { setWebSocketServers } from './routes/healthRoutes.js';
import { startPresenceCleanup } from './routes/presenceRoutes.js';
import memoryManager from './utils/memoryManager.js';
import { logger } from './utils/logger.js';
import { startServer, installShutdownHandlers } from './lifecycle.js';

if (!process.env.JWT_SECRET) {
  logger.critical('JWT_SECRET is not set — refusing to start');
  process.exit(1);
}

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET;

const app = createApp();
const server = http.createServer(app);

const chatWS = setupWebSocketServer();

setWebSocketServers(chatWS);
memoryManager.setWebSocketServers(chatWS);
startPresenceCleanup();

server.on('upgrade', createUpgradeHandler({ chatWS, jwtSecret: JWT_SECRET }));

startServer({ server, port: PORT })
  .then((intervals) => {
    installShutdownHandlers({ server, chatWS, intervals });
  })
  .catch((error) => {
    logger.critical('Database connection failed:', { error: error.message });
    process.exit(1);
  });
