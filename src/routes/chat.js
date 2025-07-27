import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.get('/:locationId', authenticateToken, ChatController.getMessages);
router.post('/:locationId', authenticateToken, RateLimitMiddleware.chatMessageLimit, ChatController.addMessage);

// Skill launch route
router.post('/skills/:skillId', authenticateToken, RateLimitMiddleware.skillUsageLimit, ChatController.launchSkill);

export default router;
