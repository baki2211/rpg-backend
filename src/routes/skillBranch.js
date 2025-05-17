import express from 'express';
import { SkillBranchController } from '../controllers/SkillBranchController.js';

const router = express.Router();

router.get('/', SkillBranchController.getAllSkillBranches);
router.get('/:id', SkillBranchController.getSkillBranchById);
router.post('/', SkillBranchController.createSkillBranch);
router.put('/:id', SkillBranchController.updateSkillBranch);
router.delete('/:id', SkillBranchController.deleteSkillBranch);

export default router; 