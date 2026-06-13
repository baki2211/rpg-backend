import express from 'express';
import { SkillValidationRuleController } from '../controllers/SkillValidationRuleController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/categories', SkillValidationRuleController.getRulesByCategory);
router.post('/initialize', isAdmin, SkillValidationRuleController.initializeDefaultRules);
router.post('/validate', SkillValidationRuleController.validateSkill);
router.get('/type/:skillType/:skillSubtype', SkillValidationRuleController.getRuleByTypeAndSubtype);
router.get('/', SkillValidationRuleController.getAllRules);
router.get('/:id', SkillValidationRuleController.getRuleById);
router.post('/', isAdmin, SkillValidationRuleController.createRule);
router.put('/:id', isAdmin, SkillValidationRuleController.updateRule);
router.delete('/:id', isAdmin, SkillValidationRuleController.deleteRule);

export default router;
