import express from 'express';
import { CombatConstantController } from '../controllers/CombatConstantController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const combatConstantController = new CombatConstantController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/combat-constants/categories - Get constants organized by category
router.get('/categories', combatConstantController.getConstantsByCategory.bind(combatConstantController));

// POST /api/combat-constants/initialize - Initialize default constants (admin only)
router.post('/initialize', combatConstantController.initializeDefaultConstants.bind(combatConstantController));

// GET /api/combat-constants - Get all combat constants
router.get('/', combatConstantController.getAllCombatConstants.bind(combatConstantController));

// GET /api/combat-constants/:id - Get combat constant by ID
router.get('/:id', combatConstantController.getCombatConstantById.bind(combatConstantController));

// POST /api/combat-constants - Create new combat constant (admin only)
router.post('/', combatConstantController.createCombatConstant.bind(combatConstantController));

// PUT /api/combat-constants/:id - Update combat constant (admin only)
router.put('/:id', combatConstantController.updateCombatConstant.bind(combatConstantController));

// DELETE /api/combat-constants/:id - Delete combat constant (admin only)
router.delete('/:id', combatConstantController.deleteCombatConstant.bind(combatConstantController));

export default router;
