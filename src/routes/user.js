import express from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const adminOnly = requireRole(['admin']);

router.get('/', authenticateToken, UserController.getUsers);
router.get('/dashboard', authenticateToken, UserController.getDashboard);

// Admin-only listings
router.get('/all', authenticateToken, adminOnly, UserController.getAllUsers);
router.get('/role/:role', authenticateToken, adminOnly, UserController.getUsersByRole);

// Admin-only mutations
router.put('/:userId/role', authenticateToken, adminOnly, UserController.updateUserRole);
router.put('/:userId/admin-password-reset', authenticateToken, adminOnly, UserController.adminResetPassword);

// Self-service password update (ownership enforced in controller)
router.put('/:userId/password', authenticateToken, UserController.updateUserPassword);

export default router;
