import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/:locationId', authenticateToken, ChatController.getMessages);
router.post('/:locationId', authenticateToken, ChatController.addMessage);

// Skill launch route
router.post('/skills/:skillId', authenticateToken, ChatController.launchSkill);

export default router;
