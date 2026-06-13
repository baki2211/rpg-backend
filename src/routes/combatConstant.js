import express from 'express';
import { CombatConstantController } from '../controllers/CombatConstantController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/categories', CombatConstantController.getConstantsByCategory);
router.post('/initialize', isAdmin, CombatConstantController.initializeDefaultConstants);
router.get('/', CombatConstantController.getAllCombatConstants);
router.get('/:id', CombatConstantController.getCombatConstantById);
router.post('/', isAdmin, CombatConstantController.createCombatConstant);
router.put('/:id', isAdmin, CombatConstantController.updateCombatConstant);
router.delete('/:id', isAdmin, CombatConstantController.deleteCombatConstant);

export default router;
