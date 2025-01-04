import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import raceRoutes from './race.js';

const router = Router();

// Admin dashboard route
router.get('/dashboard', authenticateToken, isAdmin, (req, res) => {
    res.status(200).json({ message: 'Welcome to the admin dashboard!' });
});

// Nested race management routes
router.use('/races', authenticateToken, isAdmin, raceRoutes);

export default router;
