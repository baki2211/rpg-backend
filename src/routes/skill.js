import express from 'express';
import { SkillController } from '../controllers/SkillController.js';

const router = express.Router();

router.get('/', SkillController.getAllSkills);
router.get('/:id', SkillController.getSkillById);
router.post('/', SkillController.createSkill);
router.put('/:id', SkillController.updateSkill);
router.delete('/:id', SkillController.deleteSkill);

export default router; 