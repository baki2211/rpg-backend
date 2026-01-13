import express from 'express';
import { MasteryTierController } from '../controllers/MasteryTierController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const masteryTierController = new MasteryTierController();

// Apply authentication to all routes
router.use(authenticateToken);

// POST /api/mastery-tiers/initialize - Initialize default tiers (admin only)
router.post('/initialize', masteryTierController.initializeDefaultTiers.bind(masteryTierController));

// GET /api/mastery-tiers/uses/:uses - Get mastery tier for given uses
router.get('/uses/:uses', masteryTierController.getMasteryTierForUses.bind(masteryTierController));

// GET /api/mastery-tiers - Get all mastery tiers
router.get('/', masteryTierController.getAllMasteryTiers.bind(masteryTierController));

// GET /api/mastery-tiers/:id - Get mastery tier by ID
router.get('/:id', masteryTierController.getMasteryTierById.bind(masteryTierController));

// POST /api/mastery-tiers - Create new mastery tier (admin only)
router.post('/', masteryTierController.createMasteryTier.bind(masteryTierController));

// PUT /api/mastery-tiers/:id - Update mastery tier (admin only)
router.put('/:id', masteryTierController.updateMasteryTier.bind(masteryTierController));

// DELETE /api/mastery-tiers/:id - Delete mastery tier (admin only)
router.delete('/:id', masteryTierController.deleteMasteryTier.bind(masteryTierController));

export default router;
