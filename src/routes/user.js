import express from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/', authenticateToken, UserController.getUsers);
router.get('/dashboard', authenticateToken, UserController.getDashboard);

// Admin-only listings
router.get('/all', authenticateToken, isAdmin, UserController.getAllUsers);
router.get('/role/:role', authenticateToken, isAdmin, UserController.getUsersByRole);

// Admin-only mutations
router.put('/:userId/role', authenticateToken, isAdmin, UserController.updateUserRole);
router.put('/:userId/admin-password-reset', authenticateToken, isAdmin, UserController.adminResetPassword);

// Self-service password update (ownership enforced in controller)
router.put('/:userId/password', authenticateToken, UserController.updateUserPassword);

export default router;
