import express from 'express';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { CharacterService } from '../services/CharacterService.js';

const router = express.Router();
const presenceEmitter = new EventEmitter();
const onlineUsers = new Map(); // userId => { username, characterName, location, lastSeen }
const characterService = new CharacterService();

// SSE endpoint for presence updates
router.get('/events', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Add user to online users if not present
  if (!onlineUsers.has(userId)) {
    try {
      const activeCharacter = await characterService.getActiveCharacter(userId);
      onlineUsers.set(userId, {
        username: req.query.username || userId,
        characterName: activeCharacter?.name || null,
        location: 'Dashboard',
        lastSeen: new Date()
      });
      logger.info(`User ${userId} connected to presence system`);
      broadcastUsers();
    } catch (error) {
      logger.error(`Error getting character for user ${userId}:`, error);
    }
  }

  // Send initial state
  res.write(`data: ${JSON.stringify({
    type: 'onlineUsers',
    users: Array.from(onlineUsers.entries()).map(([id, user]) => ({
      userId: id,
      username: user.username,
      characterName: user.characterName,
      location: user.location
    }))
  })}\n\n`);

  // Listen for updates
  const updateHandler = (users) => {
    res.write(`data: ${JSON.stringify({
      type: 'onlineUsers',
      users
    })}\n\n`);
  };

  presenceEmitter.on('usersUpdated', updateHandler);

  // Send heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000); // Every 30 seconds

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    presenceEmitter.off('usersUpdated', updateHandler);
    
    // Remove user if they disconnect
    if (onlineUsers.has(userId)) {
      onlineUsers.delete(userId);
      logger.info(`User ${userId} disconnected from presence system`);
      broadcastUsers();
    }
  });
});

// Update user location
router.post('/location', async (req, res) => {
  const { userId, location } = req.body;
  if (!userId || !location) {
    return res.status(400).json({ error: 'Missing userId or location' });
  }

  try {
    const user = onlineUsers.get(userId);
    if (user) {
      // Only update if location changed
      if (user.location !== location) {
        user.location = location;
        user.lastSeen = new Date();
        
        // Update character info
        try {
          const activeCharacter = await characterService.getActiveCharacter(userId);
          user.characterName = activeCharacter?.name || null;
        } catch (error) {
          logger.debug(`Character lookup failed for user ${userId}: ${error.message}`);
        }
        
        logger.debug(`User ${userId} location updated to ${location}`);
        broadcastUsers();
      }
    } else {
      // If user not in onlineUsers, add them
      const activeCharacter = await characterService.getActiveCharacter(userId);
      onlineUsers.set(userId, {
        username: req.body.username || userId,
        characterName: activeCharacter?.name || null,
        location,
        lastSeen: new Date()
      });
      logger.info(`User ${userId} reconnected to presence system`);
      broadcastUsers();
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`Error updating location for user ${userId}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat endpoint
router.post('/heartbeat', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const user = onlineUsers.get(userId);
  if (user) {
    user.lastSeen = new Date();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Cleanup stale users every 30 seconds
setInterval(() => {
  const now = new Date();
  let updated = false;

  for (const [userId, user] of onlineUsers.entries()) {
    if (now - user.lastSeen > 60000) { // 1 minute
      onlineUsers.delete(userId);
      updated = true;
      logger.debug(`Removed stale user ${userId} from presence system`);
    }
  }

  if (updated) {
    broadcastUsers();
  }
}, 30000);

function broadcastUsers() {
  const users = Array.from(onlineUsers.entries()).map(([id, user]) => ({
    userId: id,
    username: user.username,
    characterName: user.characterName,
    location: user.location
  }));
  presenceEmitter.emit('usersUpdated', users);
}

export default router; 