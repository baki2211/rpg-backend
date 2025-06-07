import express from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const userController = new UserController();

router.get('/', authenticateToken, UserController.getUsers);
router.get('/dashboard', authenticateToken, UserController.getDashboard);

// Get all users (admin only)
router.get('/all', authenticateToken, userController.getAllUsers.bind(userController));

// Get users by role (admin only)
router.get('/role/:role', authenticateToken, userController.getUsersByRole.bind(userController));

// Update user role (admin only)
router.put('/:userId/role', authenticateToken, userController.updateUserRole.bind(userController));

export default router;
