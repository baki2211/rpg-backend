import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const rejectUpgrade = (socket, status, message) => {
  const body = message;
  socket.write(
    `HTTP/1.1 ${status}\r\n` +
    'Connection: close\r\n' +
    'Content-Type: text/plain\r\n' +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    '\r\n' +
    body
  );
  socket.destroy();
};

// Same-origin browsers send the session cookie on the WS handshake. The raw
// http upgrade doesn't run cookie-parser, so parse the Cookie header by hand.
const extractTokenFromCookieHeader = (cookieHeader) => {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'token') return decodeURIComponent(rest.join('='));
  }
  return null;
};

// Budget is configurable so the same code works on hosts with much more
// (or less) RAM than the historical 512MB default.
const computeChatConnectionLimit = () => {
  const memoryUsage = process.memoryUsage();
  const memoryBudgetMb = Number(process.env.WS_MEMORY_BUDGET_MB) || 512;
  const memoryUsagePercent = (memoryUsage.rss / (memoryBudgetMb * 1024 * 1024)) * 100;

  let maxConnections = 15;
  if (memoryUsagePercent > 85) {
    maxConnections = 8;
  } else if (memoryUsagePercent > 70) {
    maxConnections = 12;
  }

  return { maxConnections, memoryUsagePercent };
};

export function createUpgradeHandler({ chatWS, jwtSecret }) {
  return (req, socket, head) => {
    try {
      const pathname = req.url?.split('?')[0];

      if (pathname !== '/ws/chat') {
        socket.destroy();
        return;
      }

      const token = extractTokenFromCookieHeader(req.headers.cookie);
      if (!token) {
        rejectUpgrade(socket, '401 Unauthorized', 'Missing session cookie');
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch (err) {
        logger.warn('Chat WebSocket upgrade rejected - token verification failed', { error: err.message });
        rejectUpgrade(socket, '401 Unauthorized', 'Invalid token');
        return;
      }

      req.user = decoded;

      const chatConnections = chatWS.getConnectionCount();
      const { maxConnections, memoryUsagePercent } = computeChatConnectionLimit();

      if (chatConnections >= maxConnections) {
        logger.warn(`Chat WebSocket upgrade rejected - connection limit reached: ${chatConnections}/${maxConnections} (memory: ${memoryUsagePercent.toFixed(1)}%)`);
        rejectUpgrade(socket, '503 Service Unavailable', 'Server overloaded - too many connections');
        return;
      }

      chatWS.handleUpgrade(req, socket, head);
    } catch (error) {
      logger.error('WebSocket upgrade error:', { error: error.message });
      socket.write('HTTP/1.1 500 Internal Server Error\r\n' +
                   'Connection: close\r\n' +
                   'Content-Type: text/plain\r\n' +
                   'Content-Length: 21\r\n' +
                   '\r\n' +
                   'Internal Server Error');
      socket.destroy();
    }
  };
}
