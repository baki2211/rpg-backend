import express from 'express';
import { StatDefinitionController } from '../controllers/StatDefinitionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const statDefinitionController = new StatDefinitionController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/stat-definitions - Get all stat definitions
router.get('/', statDefinitionController.getAllStatDefinitions.bind(statDefinitionController));

// GET /api/stat-definitions/categories - Get stats organized by category
router.get('/categories', statDefinitionController.getStatsByCategory.bind(statDefinitionController));

// POST /api/stat-definitions/initialize - Initialize default stats (admin only)
router.post('/initialize', statDefinitionController.initializeDefaultStats.bind(statDefinitionController));

// GET /api/stat-definitions/:id - Get stat definition by ID
router.get('/:id', statDefinitionController.getStatDefinitionById.bind(statDefinitionController));

// POST /api/stat-definitions - Create new stat definition (admin only)
router.post('/', statDefinitionController.createStatDefinition.bind(statDefinitionController));

// PUT /api/stat-definitions/:id - Update stat definition (admin only)
router.put('/:id', statDefinitionController.updateStatDefinition.bind(statDefinitionController));

// DELETE /api/stat-definitions/:id - Delete stat definition (admin only)
router.delete('/:id', statDefinitionController.deleteStatDefinition.bind(statDefinitionController));

export default router; 