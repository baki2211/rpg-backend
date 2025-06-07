import express from 'express';
import { SessionController } from '../controllers/sessionController.js';

const router = express.Router();
const sessionController = new SessionController();

// Get all sessions
router.get('/active', sessionController.getAllSessions.bind(sessionController));

// Get closed sessions
router.get('/closed', sessionController.getClosedSessions.bind(sessionController));

// Create a new session
router.post('/', sessionController.createSession.bind(sessionController));

// Get session by location
router.get('/location/:locationId', sessionController.getSessionByLocation.bind(sessionController));

// Get participants by location
router.get('/location/:locationId/participants', sessionController.getLocationParticipants.bind(sessionController));

// Get all participants in a session
router.get('/:sessionId/participants', sessionController.getParticipants.bind(sessionController));

// Add participant to session
router.post('/:sessionId/participants', sessionController.addParticipant.bind(sessionController));

// Remove participant from session
router.delete('/:sessionId/participants/:characterId', sessionController.removeParticipant.bind(sessionController));

// Update session status (freeze/unfreeze)
router.put('/:sessionId/status', sessionController.updateSessionStatus.bind(sessionController));

// Update session active state (open/close)
router.put('/:sessionId/active', sessionController.updateSessionActive.bind(sessionController));

// Get a specific session
router.get('/:id', sessionController.getSession.bind(sessionController));

export default router;