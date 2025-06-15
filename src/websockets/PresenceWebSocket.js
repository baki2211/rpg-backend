import { WebSocketServer, WebSocket } from 'ws';
import { CharacterService } from '../services/CharacterService.js';
import { logger } from '../utils/logger.js';

export const setupPresenceWebSocketServer = (server) => {
  const wss = new WebSocketServer({ 
    noServer: true,
    maxPayload: 1024 * 16, // Limit payload size to 16KB
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 1, // Fast compression
        chunkSize: 1024,
      },
      threshold: 1024,
      concurrencyLimit: 10,
      serverMaxWindowBits: 13, // Value must be 8..15
      clientMaxWindowBits: 13, // Value must be 8..15
      serverMaxNoContextTakeover: false,
      clientMaxNoContextTakeover: false,
    }
  });
  
  const onlineUsers = new Map(); // userId => WebSocket
  const characterService = new CharacterService();
  const MAX_CONNECTIONS = 50; // Limit concurrent connections
  let connectionCount = 0;

  // Optimized periodic broadcast - less frequent to save resources
  const periodicBroadcast = setInterval(() => {
    if (onlineUsers.size > 0) {
      broadcastOnlineUsers();
    }
  }, 60000); // Broadcast every 60 seconds instead of 30

  // Connection cleanup interval
  const cleanupInterval = setInterval(() => {
    cleanupStaleConnections();
  }, 120000); // Cleanup every 2 minutes

  wss.on('connection', async (ws, req) => {
    // Check connection limit
    if (connectionCount >= MAX_CONNECTIONS) {
      logger.warn(`Connection limit reached (${MAX_CONNECTIONS}), rejecting new connection`);
      ws.close(1013, 'Server overloaded');
      return;
    }

    const params = new URLSearchParams(req.url?.split('?')[1]);
    const userId = params.get('userId');
    const username = params.get('username') || userId;

    if (!userId) {
      ws.close(1008, 'Missing userId');
      return;
    }

    // Check for existing connection and close it
    const existingUser = onlineUsers.get(userId);
    if (existingUser && existingUser.ws.readyState === WebSocket.OPEN) {
      logger.debug(`Closing existing connection for user ${userId}`);
      existingUser.ws.close(1000, 'New connection established');
      connectionCount--;
    }

    connectionCount++;
    logger.debug(`New presence connection for user ${userId}. Total connections: ${connectionCount}`);

    // Get user's active character (with timeout to prevent hanging)
    let activeCharacter = null;
    try {
      const characterPromise = characterService.getActiveCharacter(userId);
      activeCharacter = await Promise.race([
        characterPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    } catch (error) {
      logger.debug(`No active character found for user ${userId}: ${error.message}`);
    }

    const userInfo = {
      ws,
      userId,
      username,
      characterName: activeCharacter?.name || null,
      location: 'Dashboard',
      lastSeen: new Date(),
      messageCount: 0, // Track message frequency
    };

    onlineUsers.set(userId, userInfo);

    // Send current online users to the new connection immediately (throttled)
    sendOnlineUsersToClient(ws);

    // Broadcast to all other users that someone joined (debounced)
    debouncedBroadcast();

    ws.on('message', async (raw) => {
      const user = onlineUsers.get(userId);
      if (!user) return;

      // Rate limiting - max 10 messages per minute
      user.messageCount++;
      if (user.messageCount > 10) {
        logger.warn(`Rate limit exceeded for user ${userId}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      let msg;
      try { 
        msg = JSON.parse(raw); 
      } catch { 
        return; 
      }

      user.lastSeen = new Date();

      if (msg.type === 'updateLocation' && typeof msg.location === 'string') {
        if (user.location !== msg.location) {
          user.location = msg.location;
          
          // Only update character info if location actually changed
          try {
            const characterPromise = characterService.getActiveCharacter(userId);
            const activeCharacter = await Promise.race([
              characterPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
            
            if (activeCharacter?.name !== user.characterName) {
              logger.debug(`User ${userId} character changed from ${user.characterName} to ${activeCharacter?.name}`);
              user.characterName = activeCharacter?.name || null;
            }
          } catch (error) {
            logger.debug(`Character lookup failed for user ${userId}: ${error.message}`);
          }
          
          // Debounced broadcast for location changes
          debouncedBroadcast();
        }
      } else if (msg.type === 'getOnlineUsers') {
        sendOnlineUsersToClient(ws);
      } else if (msg.type === 'ping') {
        // Simple pong response
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('{"type":"pong"}');
        }
      } else if (msg.type === 'refreshCharacter') {
        try {
          const characterPromise = characterService.getActiveCharacter(userId);
          const activeCharacter = await Promise.race([
            characterPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          
          user.characterName = activeCharacter?.name || null;
          debouncedBroadcast();
        } catch (error) {
          logger.debug(`Character refresh failed for user ${userId}: ${error.message}`);
          user.characterName = null;
        }
      }
    });

    // Optimized ping interval - less frequent
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 45000); // Ping every 45 seconds instead of 30

    // Reset message count every minute
    const resetCountInterval = setInterval(() => {
      const user = onlineUsers.get(userId);
      if (user) {
        user.messageCount = 0;
      }
    }, 60000);

    ws.on('close', () => {
      onlineUsers.delete(userId);
      connectionCount--;
      logger.debug(`Connection closed for user ${userId}. Total connections: ${connectionCount}`);
      clearInterval(pingInterval);
      clearInterval(resetCountInterval);
      debouncedBroadcast();
    });

    ws.on('error', (err) => {
      logger.error(`Presence WebSocket error for user ${userId}:`, { error: err.message });
      onlineUsers.delete(userId);
      connectionCount--;
      clearInterval(pingInterval);
      clearInterval(resetCountInterval);
    });

    ws.on('pong', () => {
      const user = onlineUsers.get(userId);
      if (user) {
        user.lastSeen = new Date();
      }
    });
  });

  // Debounced broadcast to prevent spam
  let broadcastTimeout = null;
  const debouncedBroadcast = () => {
    if (broadcastTimeout) {
      clearTimeout(broadcastTimeout);
    }
    broadcastTimeout = setTimeout(() => {
      broadcastOnlineUsers();
      broadcastTimeout = null;
    }, 1000); // Wait 1 second before broadcasting
  };

  const sendOnlineUsersToClient = (ws) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    
    const users = Array.from(onlineUsers.values()).map(({ userId, username, characterName, location }) => ({
      userId, 
      username, 
      characterName,
      location
    }));
    
    const payload = JSON.stringify({ type: 'onlineUsers', users });
    ws.send(payload);
  };

  const cleanupStaleConnections = () => {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [userId, user] of onlineUsers.entries()) {
      // Remove connections older than 5 minutes or with closed WebSocket
      if (now - user.lastSeen > 5 * 60 * 1000 || user.ws.readyState !== WebSocket.OPEN) {
        logger.debug(`Cleaning up stale connection for user ${userId}`);
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.close();
        }
        onlineUsers.delete(userId);
        connectionCount--;
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} stale connections. Active connections: ${connectionCount}`);
      broadcastOnlineUsers();
    }
  };

  const broadcastOnlineUsers = () => {
    if (onlineUsers.size === 0) return;
    
    const users = Array.from(onlineUsers.values()).map(({ userId, username, characterName, location }) => ({
      userId, 
      username, 
      characterName,
      location
    }));
    
    const payload = JSON.stringify({ type: 'onlineUsers', users });
    let broadcastCount = 0;
    let failedCount = 0;
    
    for (const [userId, { ws }] of onlineUsers.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
          broadcastCount++;
        } catch (error) {
          logger.warn(`Failed to send to user ${userId}: ${error.message}`);
          failedCount++;
        }
      } else {
        failedCount++;
      }
    }
    
    if (failedCount > 0) {
      logger.debug(`Broadcast sent to ${broadcastCount} users, ${failedCount} failed`);
    }
  };

  const cleanup = () => {
    clearInterval(periodicBroadcast);
    clearInterval(cleanupInterval);
    if (broadcastTimeout) {
      clearTimeout(broadcastTimeout);
    }
    
    for (const { ws } of onlineUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    onlineUsers.clear();
    connectionCount = 0;
  };

  return {
    wss,
    broadcastOnlineUsers,
    cleanup,
    getConnectionCount: () => connectionCount,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  };
};

