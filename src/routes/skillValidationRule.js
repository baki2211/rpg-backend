import express from 'express';
import { SkillValidationRuleController } from '../controllers/SkillValidationRuleController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
const ruleController = new SkillValidationRuleController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/skill-validation-rules/categories - Get rules organized by category
router.get('/categories', ruleController.getRulesByCategory.bind(ruleController));

// POST /api/skill-validation-rules/initialize - Initialize default rules (admin only)
router.post('/initialize', ruleController.initializeDefaultRules.bind(ruleController));

// POST /api/skill-validation-rules/validate - Validate a skill against rules
router.post('/validate', ruleController.validateSkill.bind(ruleController));

// GET /api/skill-validation-rules/type/:skillType/:skillSubtype - Get rule by type and subtype
router.get('/type/:skillType/:skillSubtype', ruleController.getRuleByTypeAndSubtype.bind(ruleController));

// GET /api/skill-validation-rules - Get all rules
router.get('/', ruleController.getAllRules.bind(ruleController));

// GET /api/skill-validation-rules/:id - Get rule by ID
router.get('/:id', ruleController.getRuleById.bind(ruleController));

// POST /api/skill-validation-rules - Create new rule (admin only)
router.post('/', ruleController.createRule.bind(ruleController));

// PUT /api/skill-validation-rules/:id - Update rule (admin only)
router.put('/:id', ruleController.updateRule.bind(ruleController));

// DELETE /api/skill-validation-rules/:id - Delete rule (admin only)
router.delete('/:id', ruleController.deleteRule.bind(ruleController));

export default router;
