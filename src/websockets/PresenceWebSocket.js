import { WebSocketServer, WebSocket } from 'ws';

export const setupPresenceWebSocketServer = (server) => {
  const wss = new WebSocketServer({ noServer: true }); // noServer mode for routing manually
  const onlineUsers = new Map(); // userId => WebSocket

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const userId = params.get('userId');
    const username = params.get('username') || userId;

    if (!userId) {
      ws.close(1008, 'Missing userId');
      return;
    }

   // ws.userId = userId;
    onlineUsers.set(userId, {
      ws,
      username,
      location: 'Dashboard',
    });

    broadcastOnlineUsers();

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); }
      catch { return; }

      if (msg.type === 'updateLocation' && typeof msg.location === 'string') {
        const user = onlineUsers.get(userId);
        if (user) {
          user.location = msg.location;
          broadcastOnlineUsers();
        }
      }
    });

    // Ping-pong to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
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
      console.log(`Pong from ${userId}`);
    });
  });

  const broadcastOnlineUsers = () => {
    const users = Array.from(onlineUsers.values()).map(({ username, location }) => ({
      username, location
    }));
    const payload = JSON.stringify({ type: 'onlineUsers', users });

    for (const { ws } of onlineUsers.values()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  };

  return { wss, handleUpgrade(request, socket, head) {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/ws/presence') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } };
};
