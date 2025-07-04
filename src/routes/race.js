// src/routes/raceRoutes.ts
import { Router } from 'express';
import { RaceController } from '../controllers/raceController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = Router();

// Get all races
router.get('/', authenticateToken, RaceController.getAllRaces);

// Get playable races only (for character creation)
router.get('/playable', authenticateToken, RaceController.getPlayableRaces);

// Get a race by ID
router.get('/:id', authenticateToken, RaceController.getRaceById);

// Create a new race (admin only)
router.post('/new', authenticateToken, isAdmin, RaceController.createRace);

// Update a race (admin only)
router.put('/update/:id', authenticateToken, isAdmin, RaceController.updateRace);

// Delete a race (admin only)
router.delete('/delete/:id', authenticateToken, isAdmin, RaceController.deleteRace);

export default router;
