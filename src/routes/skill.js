import express from 'express';
import { SkillController } from '../controllers/SkillController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const adminOnly = requireRole(['admin']);

// Reads and skill use need a login; skill definitions are edited by admins only
router.use(authenticateToken);

router.post('/use', SkillController.useSkill);
router.get('/', SkillController.getAllSkills);
router.get('/:id', SkillController.getSkillById);
router.post('/', adminOnly, SkillController.createSkill);
router.put('/:id', adminOnly, SkillController.updateSkill);
router.delete('/:id', adminOnly, SkillController.deleteSkill);

export default router;
