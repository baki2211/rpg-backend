import express from 'express';
import { MasteryTierController } from '../controllers/MasteryTierController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/initialize', isAdmin, MasteryTierController.initializeDefaultTiers);
router.get('/uses/:uses', MasteryTierController.getMasteryTierForUses);
router.get('/', MasteryTierController.getAllMasteryTiers);
router.get('/:id', MasteryTierController.getMasteryTierById);
router.post('/', isAdmin, MasteryTierController.createMasteryTier);
router.put('/:id', isAdmin, MasteryTierController.updateMasteryTier);
router.delete('/:id', isAdmin, MasteryTierController.deleteMasteryTier);

export default router;
