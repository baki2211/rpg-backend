import express from 'express';
import { SkillBranchController } from '../controllers/SkillBranchController.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const adminOnly = requireRole(['admin']);

// Reads need a login; definitions are edited by admins only
router.use(authenticateToken);

router.get('/', SkillBranchController.getAllSkillBranches);
router.get('/:id', SkillBranchController.getSkillBranchById);
router.post('/', adminOnly, SkillBranchController.createSkillBranch);
router.put('/:id', adminOnly, SkillBranchController.updateSkillBranch);
router.delete('/:id', adminOnly, SkillBranchController.deleteSkillBranch);

export default router;
