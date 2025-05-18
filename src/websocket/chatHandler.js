import { WebSocket } from 'ws';
import { ChatService } from '../services/ChatService.js';
import { SessionService } from '../services/SessionService.js';

export class ChatHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.chatService = new ChatService();
    this.sessionService = new SessionService();
    this.sessions = new Map(); // Map to store active sessions and their connections

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  async handleConnection(ws, req) {
    const url = new URL(req.url, 'ws://localhost');
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      ws.close(1008, 'Session ID is required');
      return;
    }

    // Get session and validate
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      ws.close(1008, 'Invalid session');
      return;
    }

    // Add connection to session
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId).add(ws);

    // Handle messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'message') {
          const chatMessage = await this.chatService.addMessage(
            data.userId,
            sessionId,
            data.content
          );

          // Broadcast to all connections in the session
          this.sessions.get(sessionId).forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(chatMessage));
            }
          });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({ error: 'Failed to process message' }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      this.sessions.get(sessionId)?.delete(ws);
      if (this.sessions.get(sessionId)?.size === 0) {
        this.sessions.delete(sessionId);
      }
    });
  }
} 