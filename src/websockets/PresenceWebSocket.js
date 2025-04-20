import { WebSocketServer } from 'ws';

export const setupPresenceWebSocketServer = (server) => {
  const wss = new WebSocketServer({ noServer: true }); // noServer mode for routing manually
  const onlineUsers = new Map(); // userId => WebSocket

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const userId = params.get('userId');

    if (!userId) {
      ws.close(1008, 'Missing userId');
      return;
    }

    ws.userId = userId;
    onlineUsers.set(userId, ws);

    console.log(`User ${userId} connected to presence server`);

    // Notify others
    broadcastOnlineUsers();

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
    const userIds = Array.from(onlineUsers.keys());
    const payload = JSON.stringify({ type: 'onlineUsers', users: userIds });

    for (const [id, client] of onlineUsers.entries()) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  };

  return { wss, handleUpgrade };

  function handleUpgrade(request, socket, head) {
    const pathname = request.url?.split('?')[0];
    if (pathname === '/ws/presence') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  }
};
