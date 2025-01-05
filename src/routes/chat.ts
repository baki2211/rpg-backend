import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';

const router = Router();

router.get('/:locationId', ChatController.getMessages);
router.post('/:locationId', ChatController.addMessage);

export default router;
