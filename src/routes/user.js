import express from 'express';
import { UserController } from '../controllers/UserController.js';
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

// Update own password (caller must supply their old password)
router.put('/:userId/password', authenticateToken, userController.updateUserPassword.bind(userController));

// Admin reset another user's password (no old password required; admin role enforced in controller)
router.put('/:userId/admin-password-reset', authenticateToken, userController.adminResetPassword.bind(userController));

export default router;
