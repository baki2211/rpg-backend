import { WebSocketServer, WebSocket } from 'ws';
import { ChatService } from './services/ChatService.js';

export const setupWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server });
  const chatService = new ChatService();

  wss.on('connection', (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');

    if (!locationId) {
      ws.close(1008, 'Missing locationId');
      return;
    }

    ws.locationId = locationId;
    console.log(`WebSocket connection established for location: ${locationId}`);

    // Ping-pong to keep the connection alive
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());

        // Save the message to the database
        const savedMessage = await chatService.addMessage(
          Number(locationId),
          parsedMessage.userId,
          parsedMessage.username,
          parsedMessage.message
        );

        // Broadcast the saved message to all clients in the same location
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client.locationId === locationId) {
            client.send(JSON.stringify(savedMessage));
          }
        });
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket connection closed for location: ${locationId}`);
      clearInterval(interval);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for location ${locationId}:`, error);
    });
  });

  return wss;
};