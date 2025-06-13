import express from 'express';
import { SessionController } from '../controllers/sessionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const sessionController = new SessionController();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all sessions for logs (admin/master only)
router.get('/logs', sessionController.getAllSessionsForLogs.bind(sessionController));

// Get all active sessions
router.get('/active', sessionController.getAllSessions.bind(sessionController));

// Get closed sessions
router.get('/closed', sessionController.getClosedSessions.bind(sessionController));

// Create a new session
router.post('/', sessionController.createSession.bind(sessionController));

// Get session by location
router.get('/location/:locationId', sessionController.getSessionByLocation.bind(sessionController));

// Get participants by location
router.get('/location/:locationId/participants', sessionController.getLocationParticipants.bind(sessionController));

// Freeze a session (admin/master only)
router.post('/:sessionId/freeze', sessionController.freezeSession.bind(sessionController));

// Unfreeze a session (admin/master only)
router.post('/:sessionId/unfreeze', sessionController.unfreezeSession.bind(sessionController));

// Close a session (admin/master only)
router.post('/:sessionId/close', sessionController.closeSession.bind(sessionController));

// Get all participants in a session
router.get('/:sessionId/participants', sessionController.getParticipants.bind(sessionController));

// Add participant to session
router.post('/:sessionId/participants', sessionController.addParticipant.bind(sessionController));

// Remove participant from session
router.delete('/:sessionId/participants/:characterId', sessionController.removeParticipant.bind(sessionController));

// Update session status (freeze/unfreeze) - legacy endpoint
router.put('/:sessionId/status', sessionController.updateSessionStatus.bind(sessionController));

// Update session active state (open/close) - legacy endpoint
router.put('/:sessionId/active', sessionController.updateSessionActive.bind(sessionController));

// Get a specific session
router.get('/:id', sessionController.getSession.bind(sessionController));

export default router;