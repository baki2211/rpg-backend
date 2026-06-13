import express from 'express';
import { CombatController } from '../controllers/CombatController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();
const masterOrAdmin = requireRole(['admin', 'master']);

// All combat routes require authentication
router.use(authenticateToken);

// Round management
router.post('/rounds', CombatController.createRound);
router.get('/rounds/active/:locationId', CombatController.getActiveRound);
router.get('/rounds/resolved/:locationId', CombatController.getResolvedRounds);
router.post('/rounds/:roundId/resolve', masterOrAdmin, CombatController.resolveRound);
router.post('/rounds/:roundId/cancel', masterOrAdmin, CombatController.cancelRound);

// Action management
router.post('/rounds/:roundId/actions', RateLimitMiddleware.combatActionLimit, CombatController.submitAction);
router.get('/rounds/:roundId/actions', CombatController.getRoundActions);

export default router;
