import express from 'express';
import { SessionController } from '../controllers/SessionController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const masterOrAdmin = requireRole(['admin', 'master']);

// Apply authentication to all routes
router.use(authenticateToken);

// Get all sessions for logs (admin/master only)
router.get('/logs', masterOrAdmin, SessionController.getAllSessionsForLogs);

// Get all active sessions
router.get('/active', SessionController.getAllSessions);

// Get closed sessions
router.get('/closed', SessionController.getClosedSessions);

// Create a new session
router.post('/', SessionController.createSession);

// Get session by location
router.get('/location/:locationId', SessionController.getSessionByLocation);

// Get participants by location
router.get('/location/:locationId/participants', SessionController.getLocationParticipants);

// Freeze a session (admin/master only)
router.post('/:sessionId/freeze', masterOrAdmin, SessionController.freezeSession);

// Unfreeze a session (admin/master only)
router.post('/:sessionId/unfreeze', masterOrAdmin, SessionController.unfreezeSession);

// Close a session (admin/master only)
router.post('/:sessionId/close', masterOrAdmin, SessionController.closeSession);

// Get all participants in a session
router.get('/:sessionId/participants', SessionController.getParticipants);

// Add participant to session
router.post('/:sessionId/participants', SessionController.addParticipant);

// Remove participant from session
router.delete('/:sessionId/participants/:characterId', SessionController.removeParticipant);

// Update session status (freeze/unfreeze) - legacy endpoint
router.put('/:sessionId/status', SessionController.updateSessionStatus);

// Update session active state (open/close) - legacy endpoint
router.put('/:sessionId/active', SessionController.updateSessionActive);

// Get a specific session
router.get('/:id', SessionController.getSession);

export default router;
