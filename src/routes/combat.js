import express from 'express';
import { CombatController } from '../controllers/CombatController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// All combat routes require authentication
router.use(authenticateToken);

// Round management
router.post('/rounds', CombatController.createRound);
router.get('/rounds/active/:locationId', CombatController.getActiveRound);
router.get('/rounds/resolved/:locationId', CombatController.getResolvedRounds);
router.post('/rounds/:roundId/resolve', CombatController.resolveRound);
router.post('/rounds/:roundId/cancel', CombatController.cancelRound);

// Action management
router.post('/rounds/:roundId/actions', RateLimitMiddleware.combatActionLimit, CombatController.submitAction);
router.get('/rounds/:roundId/actions', CombatController.getRoundActions);

export default router; 