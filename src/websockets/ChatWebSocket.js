import { WebSocketServer, WebSocket } from 'ws';
import { ChatService } from '../services/ChatService.js';
import { SessionService } from '../services/SessionService.js';

export const setupWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true }); 
  const chatService = new ChatService();
  const sessionService = new SessionService();
  const locationSessions = new Map(); // Map to track active sessions by location

  wss.on('connection', (ws, req) => {
    const queryString = req.url?.split('?')[1];
    if (!queryString) {
      ws.close(1008, 'Missing query string');
      return;
    }
    
    const params = new URLSearchParams(queryString);
    const locationId = params.get('locationId');

    if (!locationId) {
      ws.close(1008, 'Missing locationId');
      return;
    }

    ws.locationId = locationId;
    console.log(`WebSocket connection established for location: ${locationId}`);

    // Keep-alive ping
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', async (message) => {
      try {
        const parsedMessage = JSON.parse(message.toString());
        
        // Save the message and handle session management
        const savedMessage = await chatService.addMessage(
          Number(locationId),
          parsedMessage.userId,
          parsedMessage.username,
          parsedMessage.message
        );

        // Handle session if needed
        const session = await handlePaidAction(locationId, parsedMessage.userId);
        savedMessage.sessionId = session.id;

        // Single broadcast to all clients in the location
        broadcastToLocation(locationId, savedMessage);
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket connection closed:  ${code} for location: ${locationId} - ${reason.toString()}`);
      clearInterval(interval);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for location ${locationId}:`, error);
    });
  });

  const handlePaidAction = async (locationId, userId) => {
    let session = await sessionService.getActiveSessionByLocation(locationId);
    
    if (!session) {
      // Create new session if none exists
      session = await sessionService.createSession(
        `Session-${locationId}-${Date.now()}`,
        locationId
      );
      locationSessions.set(locationId, session);
    }

    // Add user to session participants if not already present
    await sessionService.addParticipantIfNotExists(session.id, userId);
    
    // Update session expiration time
    await sessionService.updateSessionExpiration(session.id);

    return session;
  };

  const broadcastToLocation = (locationId, message) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.locationId === locationId) {
        client.send(JSON.stringify(message));
      }
    });
  };

  return {
    wss,
    handleUpgrade: (request, socket, head) => {
      const pathname = request.url?.split("?")[0];
      if (pathname === "/ws/chat") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    },
  };
};