import { WebSocketServer, WebSocket } from 'ws';
import { CharacterService } from '../services/CharacterService.js';

export const setupPresenceWebSocketServer = (server) => {
  const wss = new WebSocketServer({ noServer: true }); // noServer mode for routing manually
  const onlineUsers = new Map(); // userId => WebSocket
  const characterService = new CharacterService();

  // Periodic broadcast to ensure real-time updates
  const periodicBroadcast = setInterval(() => {
    broadcastOnlineUsers();
  }, 30000); // Broadcast every 30 seconds

  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const userId = params.get('userId');
    const username = params.get('username') || userId;

    if (!userId) {
      ws.close(1008, 'Missing userId');
      return;
    }

    console.log(`User ${userId} (${username}) connected to presence WebSocket`);

    // Get user's active character
    let activeCharacter = null;
    try {
      activeCharacter = await characterService.getActiveCharacter(userId);
    } catch (error) {
      console.log(`No active character found for user ${userId}`);
    }

    const userInfo = {
      ws,
      userId,
      username,
      characterName: activeCharacter?.name || null,
      location: 'Dashboard',
      lastSeen: new Date(),
    };

    onlineUsers.set(userId, userInfo);

    // Send current online users to the new connection immediately
    const users = Array.from(onlineUsers.values()).map(({ userId, username, characterName, location }) => ({
      userId, 
      username, 
      characterName,
      location
    }));
    const payload = JSON.stringify({ type: 'onlineUsers', users });
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }

    // Broadcast to all other users that someone joined
    broadcastOnlineUsers();

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); }
      catch { return; }

      if (msg.type === 'updateLocation' && typeof msg.location === 'string') {
        const user = onlineUsers.get(userId);
        if (user) {
          const oldLocation = user.location;
          user.location = msg.location;
          user.lastSeen = new Date();
          
          console.log(`User ${userId} moved from ${oldLocation} to ${msg.location}`);
          
          // Update character info when location changes (in case user switched characters)
          try {
            const activeCharacter = await characterService.getActiveCharacter(userId);
            if (activeCharacter?.name !== user.characterName) {
              console.log(`User ${userId} character changed from ${user.characterName} to ${activeCharacter?.name}`);
              user.characterName = activeCharacter?.name || null;
            }
          } catch (error) {
            console.log(`No active character found for user ${userId}`);
            user.characterName = null;
          }
          
          // Immediate broadcast for location changes
          broadcastOnlineUsers();
          
          // Additional broadcast after a short delay to catch any race conditions
          setTimeout(() => {
            broadcastOnlineUsers();
          }, 2000);
        }
      } else if (msg.type === 'getOnlineUsers') {
        // Send current online users to the requesting client
        const users = Array.from(onlineUsers.values()).map(({ userId, username, characterName, location }) => ({
          userId, 
          username, 
          characterName,
          location
        }));
        const payload = JSON.stringify({ type: 'onlineUsers', users });
        
        console.log(`🔍 Manual getOnlineUsers request from ${userId}, sending ${users.length} users`);
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(payload);
        }
        
        // Also trigger a broadcast to all clients to ensure everyone is in sync
        setTimeout(() => {
          broadcastOnlineUsers();
        }, 100);
      } else if (msg.type === 'ping') {
        // Handle ping for keep-alive
        const user = onlineUsers.get(userId);
        if (user) {
          user.lastSeen = new Date();
          // Send pong back
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        }
      } else if (msg.type === 'refreshCharacter') {
        // Manual character refresh request
        const user = onlineUsers.get(userId);
        if (user) {
          try {
            const activeCharacter = await characterService.getActiveCharacter(userId);
            const oldCharacterName = user.characterName;
            user.characterName = activeCharacter?.name || null;
            user.lastSeen = new Date();
            
            console.log(`🔄 Character refresh for user ${userId}: ${oldCharacterName} → ${user.characterName}`);
            
            // Always broadcast after character refresh to ensure all clients get updates
            broadcastOnlineUsers();
          } catch (error) {
            console.log(`No active character found for user ${userId}`);
            user.characterName = null;
            broadcastOnlineUsers();
          }
        }
      }
    });

    // Ping-pong to keep connection alive and update last seen
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        const user = onlineUsers.get(userId);
        if (user) {
          user.lastSeen = new Date();
        }
      }
    }, 30000);

    ws.on('close', () => {
      console.log(`User ${userId} disconnected from presence`);
      onlineUsers.delete(userId);
      broadcastOnlineUsers();
      clearInterval(pingInterval);
    });

    ws.on('error', (err) => {
      console.error(`Presence WebSocket error for user ${userId}:`, err);
    });

    ws.on('pong', () => {
      const user = onlineUsers.get(userId);
      if (user) {
        user.lastSeen = new Date();
      }
    });
  });

  const broadcastOnlineUsers = () => {
    const now = new Date();
    
    // Remove stale connections (older than 2 minutes)
    for (const [userId, user] of onlineUsers.entries()) {
      if (now - user.lastSeen > 2 * 60 * 1000) {
        console.log(`Removing stale connection for user ${userId}`);
        onlineUsers.delete(userId);
      }
    }

    const users = Array.from(onlineUsers.values()).map(({ userId, username, characterName, location }) => ({
      userId, 
      username, 
      characterName,
      location
    }));
    
    const payload = JSON.stringify({ type: 'onlineUsers', users });
    console.log(`📡 Broadcasting to ${onlineUsers.size} clients:`, users.map(u => `${u.username} (${u.characterName || 'no char'}) at ${u.location}`));

    let broadcastCount = 0;
    for (const { ws } of onlineUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
        broadcastCount++;
      }
    }
    
    console.log(`✅ Successfully broadcast to ${broadcastCount} clients`);
  };

  // Cleanup function for the interval
  const cleanup = () => {
    clearInterval(periodicBroadcast);
  };

  // Export cleanup function for graceful shutdown
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return { 
    wss, 
    broadcastOnlineUsers, // Export for manual triggering
    cleanup,
    handleUpgrade(request, socket, head) {
      const pathname = request.url?.split('?')[0];
      if (pathname === '/ws/presence') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } 
  };
};
