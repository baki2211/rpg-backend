import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/dashboard', authenticateToken, UserController.getDashboard);

export default router;
