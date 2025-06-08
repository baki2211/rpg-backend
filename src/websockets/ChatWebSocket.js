import { WebSocketServer, WebSocket } from 'ws';
import { AppDataSource } from '../data-source.js';
import { Location } from '../models/locationModel.js';
import { ChatService } from '../services/ChatService.js';
import { logger } from '../utils/logger.js';

export const setupWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true });
  const locationConnections = new Map();
  let presenceBroadcaster = null;

  const setPresenceBroadcaster = (broadcaster) => {
    presenceBroadcaster = broadcaster;
  };

  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
    const userId = params.get('userId');
    const username = params.get('username');

    if (!locationId) {
      ws.close(1008, 'Missing locationId');
      return;
    }

    // Verify location exists
    try {
      const locationRepository = AppDataSource.getRepository(Location);
      const location = await locationRepository.findOne({ where: { id: parseInt(locationId) } });
      if (!location) {
        ws.close(1008, 'Invalid location');
        return;
      }
    } catch (error) {
      logger.error('Error verifying location:', { error: error.message, locationId });
      ws.close(1011, 'Server error');
      return;
    }

    logger.websocket(`Chat WebSocket connection established for location: ${locationId}, user: ${username || 'unknown'}`);

    // Trigger presence broadcast when user joins
    if (presenceBroadcaster && userId) {
      logger.debug(`Triggering presence broadcast for user ${userId} joining chat location ${locationId}`);
      presenceBroadcaster();
    }

    // Add to location connections
    if (!locationConnections.has(locationId)) {
      locationConnections.set(locationId, new Set());
    }
    locationConnections.get(locationId).add(ws);

    ws.on('message', async (data) => {
      try {
        const parsedMessage = JSON.parse(data);
        logger.debug('Received WebSocket message:', { type: parsedMessage.type, hasSkill: !!parsedMessage.skill });
        
        const chatService = new ChatService();
        
        // Save message to database with skill data
        const savedMessage = await chatService.addMessage(
          locationId,
          parsedMessage.userId,
          parsedMessage.username,
          parsedMessage.message,
          parsedMessage.skill
        );

        logger.debug('Saved message with skill:', { messageId: savedMessage.id, hasSkill: !!savedMessage.skillId });

        // Format message for broadcasting with skill data
        const messageToBroadcast = JSON.stringify({
          username: savedMessage.username,
          message: savedMessage.message,
          createdAt: savedMessage.createdAt,
          skill: savedMessage.skillId ? {
            id: savedMessage.skillId,
            name: savedMessage.skillName,
            branch: savedMessage.skillBranch,
            type: savedMessage.skillType
          } : null
        });

        logger.debug('Broadcasting message:', { hasSkill: !!savedMessage.skillId, recipientCount: locationConnections.get(locationId)?.size || 0 });

        // Broadcast to all clients in this location
        const connections = locationConnections.get(locationId);
        if (connections) {
          connections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(messageToBroadcast);
            }
          });
        }

        // Generate skill engine log for masters if skill was used
        if (parsedMessage.skill && savedMessage.skillId) {
          generateSkillEngineLog(parsedMessage, locationId);
        }

      } catch (error) {
        logger.error('Error processing chat message:', { error: error.message });
      }
    });

    ws.on('close', (code, reason) => {
      logger.websocket(`Chat WebSocket connection closed: ${code} for location: ${locationId}, user: ${username || 'unknown'} - ${reason.toString()}`);
      
      // Remove from location connections
      const connections = locationConnections.get(locationId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          locationConnections.delete(locationId);
        }
      }

      // Trigger presence broadcast when user leaves
      if (presenceBroadcaster && userId) {
        logger.debug(`Triggering presence broadcast for user ${userId} leaving chat location ${locationId}`);
        presenceBroadcaster();
      }
    });

    ws.on('error', (error) => {
      logger.error('Chat WebSocket error:', { error: error.message, locationId, username });
    });
  });

  // Helper function to generate skill engine logs for masters
  const generateSkillEngineLog = (messageData, locationId) => {
    try {
      // Create skill engine log
      const skillEngineLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        type: 'skill_use',
        actor: messageData.username,
        target: messageData.skill.selectedTarget?.characterName || 
                messageData.skill.selectedTarget?.username || 
                (messageData.skill.target === 'self' ? 'Self' : 'Area'),
        skill: messageData.skill.name,
        effects: [
          `Skill: ${messageData.skill.name}`,
          `Branch: ${messageData.skill.branch?.name || messageData.skill.branch}`,
          `Type: ${messageData.skill.type?.name || messageData.skill.type}`,
          `Target: ${messageData.skill.target}`
        ],
        details: `${messageData.username} used ${messageData.skill.name} (${messageData.skill.target} target)`
      };

      logger.skill('Generated skill engine log:', { 
        actor: skillEngineLog.actor, 
        skill: skillEngineLog.skill, 
        target: skillEngineLog.target 
      });

      // Broadcast to all masters in all locations
      broadcastSkillEngineLogToMasters(skillEngineLog);
      
    } catch (error) {
      logger.error('Error generating skill engine log:', { error: error.message });
    }
  };

  // Function to broadcast skill engine logs to masters
  const broadcastSkillEngineLogToMasters = (skillEngineLog) => {
    try {
      const skillLogMessage = JSON.stringify({
        type: 'skill_engine_log',
        locationId: skillEngineLog.locationId,
        log: skillEngineLog
      });

      let masterCount = 0;
      // Get all masters across all locations
      const masters = [];
      for (const [locId, connections] of locationConnections.entries()) {
        for (const ws of connections) {
          // Note: We can't easily determine master status from WebSocket
          // This would need to be enhanced with user role tracking
          masters.push(ws);
        }
      }

      logger.debug(`Broadcasting skill engine log to ${masters.length} clients:`, { 
        actor: skillEngineLog.actor, 
        skill: skillEngineLog.skill 
      });

      masters.forEach((masterWs) => {
        if (masterWs.readyState === WebSocket.OPEN) {
          masterWs.send(skillLogMessage);
          masterCount++;
        }
      });

    } catch (error) {
      logger.error('Error broadcasting skill engine log:', { error: error.message });
    }
  };

  return {
    wss,
    setPresenceBroadcaster,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  };
};