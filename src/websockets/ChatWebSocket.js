import { WebSocketServer, WebSocket } from 'ws';
import { ChatService } from '../services/ChatService.js';
import { SessionService } from '../services/SessionService.js';
import { CharacterService } from '../services/CharacterService.js';
import { SkillEngine } from '../services/SkillEngine.js';
import { SkillService } from '../services/SkillService.js';
import { UserService } from '../services/UserService.js';

export const setupWebSocketServer = () => {
  const wss = new WebSocketServer({ noServer: true }); 
  const chatService = new ChatService();
  const sessionService = new SessionService();
  const characterService = new CharacterService();
  const userService = new UserService();
  const locationSessions = new Map(); // Map to track active sessions by location
  
  // Store reference to presence broadcaster function
  let presenceBroadcaster = null;

  // Function to set the presence broadcaster (called from main server setup)
  const setPresenceBroadcaster = (broadcaster) => {
    presenceBroadcaster = broadcaster;
  };

  wss.on('connection', (ws, req) => {
    const queryString = req.url?.split('?')[1];
    if (!queryString) {
      ws.close(1008, 'Missing query string');
      return;
    }
    
    const params = new URLSearchParams(queryString);
    const locationId = params.get('locationId');
    const userId = params.get('userId');
    const username = params.get('username');

    if (!locationId) {
      ws.close(1008, 'Missing locationId');
      return;
    }

    ws.locationId = locationId;
    ws.userId = userId;
    ws.username = username;
    console.log(`Chat WebSocket connection established for location: ${locationId}, user: ${username || 'unknown'}`);

    // Trigger presence update when user joins chat
    if (presenceBroadcaster && userId) {
      console.log(`Triggering presence broadcast for user ${userId} joining chat location ${locationId}`);
      setTimeout(() => {
        presenceBroadcaster();
      }, 1000); // Small delay to ensure presence is updated
    }

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

        // Handle session with proper character ID
        const session = await handlePaidAction(locationId, parsedMessage.userId);
        savedMessage.sessionId = session.id;

        // If a skill was used, calculate its output and create skill engine log
        let skillEngineLog = null;
        if (parsedMessage.skill && parsedMessage.skill.id) {
          try {
            skillEngineLog = await calculateSkillOutput(parsedMessage.userId, parsedMessage.skill, locationId);
          } catch (error) {
            console.error('Error calculating skill output:', error);
          }
        }

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
        broadcastToLocation(locationId, messageToBroadcast);

        // If we have a skill engine log, broadcast it to masters
        if (skillEngineLog) {
          broadcastSkillEngineLogToMasters(locationId, skillEngineLog);
        }

        // Trigger presence update after message (in case character info changed)
        if (presenceBroadcaster) {
          setTimeout(() => {
            presenceBroadcaster();
          }, 500);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Chat WebSocket connection closed: ${code} for location: ${locationId}, user: ${username || 'unknown'} - ${reason.toString()}`);
      clearInterval(interval);
      
      // Trigger presence update when user leaves chat
      if (presenceBroadcaster && userId) {
        console.log(`Triggering presence broadcast for user ${userId} leaving chat location ${locationId}`);
        setTimeout(() => {
          presenceBroadcaster();
        }, 1000); // Small delay to ensure presence is updated
      }
    });

    ws.on('error', (error) => {
      console.error(`Chat WebSocket error for location ${locationId}:`, error);
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

  const calculateSkillOutput = async (userId, skillData, locationId) => {
    try {
      // Get the user's active character
      const character = await characterService.getActiveCharacter(userId);
      if (!character) {
        throw new Error('No active character found');
      }

      // Get the full skill data from the database
      const skill = await SkillService.getSkillById(skillData.id);
      if (!skill) {
        throw new Error('Skill not found');
      }

      // Create SkillEngine instance and calculate output
      const skillEngine = new SkillEngine(character, skill);
      const finalOutput = await skillEngine.computeFinalOutput();
      const outcomeMultiplier = skillEngine.rollOutcome();

      // Get usage info for context
      const usageInfo = await skillEngine.getSkillUses();
      const branchUsage = await skillEngine.getBranchUses();

      // Determine roll range from multiplier
      let rollDescription = 'Standard';
      if (outcomeMultiplier <= 0.6) rollDescription = 'Poor';
      else if (outcomeMultiplier >= 1.4) rollDescription = 'Critical';

      // Create skill engine log
      const skillEngineLog = {
        id: `${Date.now()}-${userId}-${skillData.id}`,
        timestamp: new Date(),
        type: 'skill_use',
        actor: character.name,
        target: skillData.selectedTarget?.characterName || 
                (skillData.target === 'self' ? character.name : 'Other'),
        skill: skill.name,
        damage: finalOutput, // Use the calculated final output
        effects: [
          `Final Output: ${finalOutput}`,
          `Base Power: ${skill.basePower}`,
          `Roll Quality: ${rollDescription}`,
          `Skill Uses: ${usageInfo}`,
          `Branch Uses: ${branchUsage}`,
          `Skill Rank: ${skillEngine.calculateSkillRankMultiplier(usageInfo)}x`,
          `Branch Rank: ${skillEngine.calculateBranchRankMultiplier(branchUsage)}x`
        ],
        details: `${character.name} used ${skill.name} (${skill.target} target) and achieved ${finalOutput} output with a ${rollDescription.toLowerCase()} roll`,
        rawData: {
          finalOutput,
          outcomeMultiplier,
          basePower: skill.basePower,
          skillUses: usageInfo,
          branchUses: branchUsage,
          skillRankMultiplier: skillEngine.calculateSkillRankMultiplier(usageInfo),
          branchRankMultiplier: skillEngine.calculateBranchRankMultiplier(branchUsage)
        }
      };

      console.log('Generated skill engine log:', skillEngineLog);
      return skillEngineLog;
    } catch (error) {
      console.error('Error in calculateSkillOutput:', error);
      return null;
    }
  };

  const broadcastToLocation = (locationId, message) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.locationId === locationId) {
        client.send(JSON.stringify(message));
      }
    });
  };

  const broadcastSkillEngineLogToMasters = async (locationId, skillEngineLog) => {
    try {
      // Get all participants in this location's session
      const participants = await sessionService.getLocationParticipants(locationId);
      
      // Get user IDs from participants
      const userIds = participants.map(p => p.userId).filter(Boolean);
      
      // Get users and filter for masters/admins
      const users = await Promise.all(userIds.map(id => userService.findById(id)));
      const masters = users.filter(user => user && (user.role === 'master' || user.role === 'admin'));
      
      if (masters.length > 0) {
        const skillLogMessage = {
          type: 'skill_engine_log',
          locationId,
          log: skillEngineLog
        };

        console.log(`Broadcasting skill engine log to ${masters.length} masters:`, skillLogMessage);

        // Broadcast to all clients in location (masters will filter client-side)
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN && client.locationId === locationId) {
            client.send(JSON.stringify(skillLogMessage));
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting skill engine log to masters:', error);
    }
  };

  return {
    wss,
    setPresenceBroadcaster,
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