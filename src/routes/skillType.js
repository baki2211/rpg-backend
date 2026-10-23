import express from 'express';
import { SkillTypeController } from '../controllers/SkillTypeController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const adminOnly = requireRole(['admin']);

// Reads need a login; definitions are edited by admins only
router.use(authenticateToken);

router.get('/', SkillTypeController.getAllSkillTypes);
router.get('/:id', SkillTypeController.getSkillTypeById);
router.post('/', adminOnly, SkillTypeController.createSkillType);
router.put('/:id', adminOnly, SkillTypeController.updateSkillType);
router.delete('/:id', adminOnly, SkillTypeController.deleteSkillType);

export default router;
