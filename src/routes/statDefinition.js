import express from 'express';
import { StatDefinitionController } from '../controllers/StatDefinitionController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', StatDefinitionController.getAllStatDefinitions);
router.get('/categories', StatDefinitionController.getStatsByCategory);
router.post('/initialize', isAdmin, StatDefinitionController.initializeDefaultStats);
router.get('/:id', StatDefinitionController.getStatDefinitionById);
router.post('/', isAdmin, StatDefinitionController.createStatDefinition);
router.put('/:id', isAdmin, StatDefinitionController.updateStatDefinition);
router.delete('/:id', isAdmin, StatDefinitionController.deleteStatDefinition);

export default router;
