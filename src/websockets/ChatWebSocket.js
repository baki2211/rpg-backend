import { WebSocketServer, WebSocket } from 'ws';
import { ChatService } from '../services/ChatService.js';
import { SessionService } from '../services/SessionService.js';
import { CharacterService } from '../services/CharacterService.js';

export const setupWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true }); 
  const chatService = new ChatService();
  const sessionService = new SessionService();
  const characterService = new CharacterService();
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
        console.log('Received WebSocket message:', parsedMessage);
        console.log('Skill data in received message:', parsedMessage.skill);
        
        // Save the message and handle session management
        const savedMessage = await chatService.addMessage(
          Number(locationId),
          parsedMessage.userId,
          parsedMessage.username,
          parsedMessage.message,
          parsedMessage.skill // Pass the skill data
        );

        console.log('Saved message with skill:', savedMessage);
        console.log('Skill data in saved message:', {
          skillId: savedMessage.skillId,
          skillName: savedMessage.skillName,
          skillBranch: savedMessage.skillBranch,
          skillType: savedMessage.skillType
        });

        // Handle session with proper character ID
        const session = await handlePaidAction(locationId, parsedMessage.userId);
        savedMessage.sessionId = session.id;

        // Single broadcast to all clients in the location
        const messageToBroadcast = {
          ...savedMessage,
          skill: savedMessage.skillId ? {
            id: savedMessage.skillId,
            name: savedMessage.skillName,
            branch: savedMessage.skillBranch,
            type: savedMessage.skillType
          } : null
        };
        
        console.log('Broadcasting message:', messageToBroadcast);
        console.log('Skill data in broadcast message:', messageToBroadcast.skill);
        broadcastToLocation(locationId, messageToBroadcast);
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

    // Get the user's active character
    const activeCharacter = await characterService.getActiveCharacter(userId);
    if (activeCharacter) {
      // Add character to session participants if not already present
      await sessionService.addParticipantIfNotExists(session.id, activeCharacter.id);
    }
    
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