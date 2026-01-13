import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import raceRoutes from './race.js';
import combatConstantRoutes from './combatConstant.js';
import masteryTierRoutes from './masteryTier.js';

const router = Router();

// Admin dashboard route
router.get('/dashboard', authenticateToken, isAdmin, (req, res) => {
    res.status(200).json({ message: 'Welcome to the admin dashboard!' });
});

// Nested race management routes
router.use('/races', authenticateToken, isAdmin, raceRoutes);

// Nested combat constants management routes
router.use('/combat-constants', authenticateToken, isAdmin, combatConstantRoutes);

// Nested mastery tier management routes
router.use('/mastery-tiers', authenticateToken, isAdmin, masteryTierRoutes);

export default router;
