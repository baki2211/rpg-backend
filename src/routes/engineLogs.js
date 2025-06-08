import express from 'express';
import { EngineLogController } from '../controllers/EngineLogController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get engine logs for a location (current active session)
router.get('/location/:locationId', EngineLogController.getLogsByLocation);

// Get engine logs for a specific session
router.get('/session/:sessionId', EngineLogController.getLogsBySession);

// Get engine logs for an event
router.get('/event/:eventId', EngineLogController.getLogsByEvent);

// Clear old logs (admin only)
router.delete('/cleanup/:daysOld', EngineLogController.clearOldLogs);

export default router; 