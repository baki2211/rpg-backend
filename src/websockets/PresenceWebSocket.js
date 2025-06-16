import { WebSocketServer, WebSocket } from 'ws';
import { CharacterService } from '../services/CharacterService.js';
import { logger } from '../utils/logger.js';

export const setupPresenceWebSocketServer = (server) => {
  const wss = new WebSocketServer({ 
    noServer: true,
    maxPayload: 1024 * 8, // Reduce payload size to 8KB
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 1, // Fast compression
        chunkSize: 512, // Smaller chunks
      },
      threshold: 512, // Lower threshold
      concurrencyLimit: 5, // Reduce concurrency
      serverMaxWindowBits: 12, // Smaller window
      clientMaxWindowBits: 12, // Smaller window
      serverMaxNoContextTakeover: true, // No context takeover for memory
      clientMaxNoContextTakeover: true, // No context takeover for memory
    }
  });
  
  const onlineUsers = new Map(); // userId => WebSocket
  const characterService = new CharacterService();
  const MAX_CONNECTIONS = 20; // Increased from 10 to 20 for better capacity
  let connectionCount = 0;
  let lastCleanupTime = Date.now();

  // Log current connection state
  const logConnectionState = () => {
    logger.info('Current WebSocket state:', {
      totalConnections: connectionCount,
      onlineUsers: Array.from(onlineUsers.entries()).map(([userId, user]) => ({
        userId,
        username: user.username,
        lastSeen: user.lastSeen,
        connectionState: user.ws.readyState,
        location: user.location
      }))
    });
  };

  // More aggressive cleanup interval - every 15 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    // Only run cleanup if it's been at least 15 seconds since last cleanup
    if (now - lastCleanupTime >= 15000) {
      logger.info('Running scheduled cleanup...');
      cleanupStaleConnections();
      logConnectionState();
      lastCleanupTime = now;
    }
  }, 15000);

  // Optimized periodic broadcast - less frequent to save resources
  const periodicBroadcast = setInterval(() => {
    if (onlineUsers.size > 0) {
      broadcastOnlineUsers();
    }
  }, 120000); // Broadcast every 2 minutes instead of 60 seconds

  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const userId = params.get('userId');
    const username = params.get('username') || userId;

    if (!userId) {
      ws.close(1008, 'Missing userId');
      return;
    }

    // Check for existing connection and close it BEFORE checking connection limit
    const existingUser = onlineUsers.get(userId);
    if (existingUser) {
      logger.debug(`Closing existing connection for user ${userId} before new connection`);
      if (existingUser.ws.readyState === WebSocket.OPEN) {
        existingUser.ws.close(1000, 'Connection refreshed');
        // Wait for the old connection to be fully closed
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Double check the connection was removed
        if (connectionCount > 0) connectionCount--;
        onlineUsers.delete(userId);
      }
    }

    // Now check connection limit after old connection is closed
    if (connectionCount >= MAX_CONNECTIONS) {
      logger.warn('Connection limit reached, forcing cleanup before new connection');
      cleanupStaleConnections();
      logConnectionState();
      
      // If still at limit after cleanup, try one more time with a delay
      if (connectionCount >= MAX_CONNECTIONS) {
        logger.warn(`Connection limit reached (${MAX_CONNECTIONS}) after first cleanup, trying one more time`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        cleanupStaleConnections();
        logConnectionState();
        
        // If still at limit after second cleanup, reject with a more specific message
        if (connectionCount >= MAX_CONNECTIONS) {
          logger.warn(`Connection limit reached (${MAX_CONNECTIONS}) after second cleanup, rejecting new connection`);
          ws.close(1013, 'Server at capacity - please try again in a few moments');
          return;
        }
      }
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
      messageCount: 0,
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

    // Optimized ping interval - less frequent to save resources
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 60000); // Ping every 60 seconds to reduce resource usage

    // Reset message count every minute
    const resetCountInterval = setInterval(() => {
      const user = onlineUsers.get(userId);
      if (user) {
        user.messageCount = 0;
      }
    }, 60000);

    ws.on('close', (code, reason) => {
      logger.info(`Connection closed for user ${userId}:`, {
        code,
        reason,
        username,
        totalConnections: connectionCount
      });
      onlineUsers.delete(userId);
      if (connectionCount > 0) connectionCount--;
      clearInterval(pingInterval);
      clearInterval(resetCountInterval);
      debouncedBroadcast();
      logConnectionState();
    });

    ws.on('error', (err) => {
      logger.error(`Presence WebSocket error for user ${userId}:`, { 
        error: err.message,
        username,
        totalConnections: connectionCount
      });
      onlineUsers.delete(userId);
      if (connectionCount > 0) connectionCount--;
      clearInterval(pingInterval);
      clearInterval(resetCountInterval);
      logConnectionState();
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
    
    logger.info('Starting cleanup of stale connections...');
    
    for (const [userId, user] of onlineUsers.entries()) {
      const timeSinceLastSeen = now - user.lastSeen;
      // Reduced stale timeout from 2 minutes to 1 minute
      const isStale = timeSinceLastSeen > 60 * 1000 || user.ws.readyState !== WebSocket.OPEN;
      
      if (isStale) {
        logger.info(`Cleaning up stale connection for user ${userId}:`, {
          timeSinceLastSeen: `${Math.round(timeSinceLastSeen / 1000)}s`,
          connectionState: user.ws.readyState,
          username: user.username
        });
        
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.close(1000, 'Connection timed out');
        }
        onlineUsers.delete(userId);
        if (connectionCount > 0) connectionCount--;
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale connections. Active connections: ${connectionCount}`);
      broadcastOnlineUsers();
    } else {
      logger.info('No stale connections found during cleanup');
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

