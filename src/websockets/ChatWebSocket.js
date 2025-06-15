import { WebSocketServer, WebSocket } from 'ws';
import { AppDataSource } from '../data-source.js';
import { Location } from '../models/locationModel.js';
import { ChatService } from '../services/ChatService.js';
import { logger } from '../utils/logger.js';

export const setupWebSocketServer = () => {
  const wss = new WebSocketServer({ 
    noServer: true,
    maxPayload: 1024 * 32, // Limit payload size to 32KB for chat
    perMessageDeflate: {
      zlibDeflateOptions: {
        level: 1, // Fast compression
        chunkSize: 1024,
      },
      threshold: 1024,
      concurrencyLimit: 10,
      serverMaxWindowBits: 13,
      clientMaxWindowBits: 13,
      serverMaxNoContextTakeover: false,
      clientMaxNoContextTakeover: false,
    }
  });
  
  const locationConnections = new Map();
  const userConnections = new Map(); // Track user connections to prevent duplicates
  let presenceBroadcaster = null;
  const MAX_CONNECTIONS_PER_LOCATION = 20;
  const MAX_TOTAL_CONNECTIONS = 100;
  let totalConnections = 0;

  const setPresenceBroadcaster = (broadcaster) => {
    presenceBroadcaster = broadcaster;
  };

  // Cleanup interval for stale connections
  const cleanupInterval = setInterval(() => {
    cleanupStaleConnections();
  }, 300000); // Cleanup every 5 minutes

  wss.on('connection', async (ws, req) => {
    // Check total connection limit
    if (totalConnections >= MAX_TOTAL_CONNECTIONS) {
      logger.warn(`Total connection limit reached (${MAX_TOTAL_CONNECTIONS}), rejecting chat connection`);
      ws.close(1013, 'Server overloaded');
      return;
    }

    const params = new URLSearchParams(req.url?.split('?')[1]);
    const locationId = params.get('locationId');
    const userId = params.get('userId');
    const username = params.get('username');

    if (!locationId) {
      ws.close(1008, 'Missing locationId');
      return;
    }

    // Check per-location connection limit
    const locationConnections_set = locationConnections.get(locationId);
    if (locationConnections_set && locationConnections_set.size >= MAX_CONNECTIONS_PER_LOCATION) {
      logger.warn(`Location ${locationId} connection limit reached (${MAX_CONNECTIONS_PER_LOCATION})`);
      ws.close(1013, 'Location full');
      return;
    }

    // Close existing connection for same user in same location
    const userKey = `${userId}-${locationId}`;
    const existingConnection = userConnections.get(userKey);
    if (existingConnection && existingConnection.readyState === WebSocket.OPEN) {
      logger.debug(`Closing existing chat connection for user ${userId} in location ${locationId}`);
      existingConnection.close(1000, 'New connection established');
      if (totalConnections > 0) totalConnections--;
    }

    // Verify location exists (with timeout)
    try {
      const locationRepository = AppDataSource.getRepository(Location);
      const locationPromise = locationRepository.findOne({ where: { id: parseInt(locationId) } });
      const location = await Promise.race([
        locationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      
      if (!location) {
        ws.close(1008, 'Invalid location');
        return;
      }
    } catch (error) {
      logger.error('Error verifying location:', { error: error.message, locationId });
      ws.close(1011, 'Server error');
      return;
    }

    totalConnections++;
    logger.debug(`New chat connection for user ${userId} in location ${locationId}. Total connections: ${totalConnections}`);

    // Store connection references
    userConnections.set(userKey, ws);
    
    // Add to location connections
    if (!locationConnections.has(locationId)) {
      locationConnections.set(locationId, new Set());
    }
    locationConnections.get(locationId).add(ws);

    // Add connection metadata
    ws.userId = userId;
    ws.locationId = locationId;
    ws.username = username;
    ws.lastActivity = new Date();
    ws.messageCount = 0;

    // Trigger presence broadcast when user joins (debounced)
    if (presenceBroadcaster && userId) {
      setTimeout(() => presenceBroadcaster(), 1000);
    }

    // Rate limiting reset interval
    const rateLimitReset = setInterval(() => {
      ws.messageCount = 0;
    }, 60000); // Reset every minute

    // Keep-alive ping - reduced frequency to save resources
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 60000); // Ping every 60 seconds to reduce resource usage

    ws.on('message', async (data) => {
      // Rate limiting - max 30 messages per minute
      ws.messageCount++;
      if (ws.messageCount > 30) {
        logger.warn(`Rate limit exceeded for user ${userId} in location ${locationId}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      ws.lastActivity = new Date();

      try {
        const parsedMessage = JSON.parse(data);
        
        // Validate message structure
        if (!parsedMessage.userId || !parsedMessage.username || !parsedMessage.message) {
          logger.warn('Invalid message structure received');
          return;
        }

        // Limit message length
        if (parsedMessage.message.length > 1000) {
          logger.warn(`Message too long from user ${userId}`);
          ws.send(JSON.stringify({ error: 'Message too long (max 1000 characters)' }));
          return;
        }

        const chatService = new ChatService();
        
        // Save message to database with skill data (with timeout)
        const savePromise = chatService.addMessage(
          locationId,
          parsedMessage.userId,
          parsedMessage.username,
          parsedMessage.message,
          parsedMessage.skill
        );
        
        const savedMessage = await Promise.race([
          savePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000))
        ]);

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

        // Broadcast to all clients in this location (with error handling)
        const connections = locationConnections.get(locationId);
        if (connections) {
          let broadcastCount = 0;
          let failedCount = 0;
          
          connections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              try {
                client.send(messageToBroadcast);
                broadcastCount++;
              } catch (error) {
                logger.warn(`Failed to send message to client: ${error.message}`);
                failedCount++;
              }
            } else {
              failedCount++;
            }
          });
          
          if (failedCount > 0) {
            logger.debug(`Chat broadcast in location ${locationId}: ${broadcastCount} sent, ${failedCount} failed`);
          }
        }

        // Generate skill engine log for masters if skill was used (async, non-blocking)
        if (parsedMessage.skill && savedMessage.skillId) {
          setImmediate(() => {
            generateSkillEngineLog(parsedMessage, locationId);
          });
        }

      } catch (error) {
        logger.error('Error processing chat message:', { error: error.message, userId, locationId });
        if (error.message === 'Database timeout') {
          ws.send(JSON.stringify({ error: 'Message could not be saved due to server load' }));
        }
      }
    });

    ws.on('close', (code, reason) => {
      // Remove from connections
      const connections = locationConnections.get(locationId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          locationConnections.delete(locationId);
        }
      }
      
      userConnections.delete(userKey);
      if (totalConnections > 0) totalConnections--;
      
      // Clear intervals
      clearInterval(rateLimitReset);
      clearInterval(pingInterval);
      
      logger.debug(`Chat connection closed for user ${userId} in location ${locationId}. Total connections: ${totalConnections}`);

      // Trigger presence broadcast when user leaves (debounced)
      if (presenceBroadcaster && userId) {
        setTimeout(() => presenceBroadcaster(), 1000);
      }
    });

    ws.on('error', (error) => {
      logger.error('Chat WebSocket error:', { error: error.message, locationId, username });
      // Clean up on error
      const connections = locationConnections.get(locationId);
      if (connections) {
        connections.delete(ws);
      }
      userConnections.delete(userKey);
      if (totalConnections > 0) totalConnections--;
      clearInterval(rateLimitReset);
      clearInterval(pingInterval);
    });

    ws.on('pong', () => {
      ws.lastActivity = new Date();
    });
  });

  const cleanupStaleConnections = () => {
    const now = new Date();
    let cleanedCount = 0;
    
    // Clean up stale connections (older than 10 minutes)
    for (const [locationId, connections] of locationConnections.entries()) {
      const staleConnections = [];
      
      for (const ws of connections) {
        if (!ws.lastActivity || now - ws.lastActivity > 10 * 60 * 1000 || ws.readyState !== WebSocket.OPEN) {
          staleConnections.push(ws);
        }
      }
      
      staleConnections.forEach(ws => {
        connections.delete(ws);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        
        // Remove from user connections
        const userKey = `${ws.userId}-${ws.locationId}`;
        userConnections.delete(userKey);
        if (totalConnections > 0) totalConnections--;
        cleanedCount++;
      });
      
      // Remove empty location sets
      if (connections.size === 0) {
        locationConnections.delete(locationId);
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} stale chat connections. Active connections: ${totalConnections}`);
    }
  };

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

      // Broadcast to all masters in all locations (non-blocking)
      setImmediate(() => {
        broadcastSkillEngineLogToMasters(skillEngineLog);
      });
      
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
      let failedCount = 0;
      
      // Get all connections across all locations
      for (const [locId, connections] of locationConnections.entries()) {
        for (const ws of connections) {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              // Note: We can't easily determine master status from WebSocket
              // This would need to be enhanced with user role tracking
              ws.send(skillLogMessage);
              masterCount++;
            } catch (error) {
              failedCount++;
            }
          }
        }
      }

      if (failedCount > 0) {
        logger.debug(`Skill log broadcast: ${masterCount} sent, ${failedCount} failed`);
      }

    } catch (error) {
      logger.error('Error broadcasting skill engine log:', { error: error.message });
    }
  };

  const cleanup = () => {
    clearInterval(cleanupInterval);
    
    // Close all connections
    for (const connections of locationConnections.values()) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    }
    
    locationConnections.clear();
    userConnections.clear();
    totalConnections = 0;
  };

  return {
    wss,
    setPresenceBroadcaster,
    cleanup,
    getConnectionCount: () => totalConnections,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  };
};