import express from 'express';
import { SkillController } from '../controllers/SkillController.js';

const router = express.Router();

router.post('/', SkillController.createSkill);
router.get('/', SkillController.getAllSkills);
router.get('/:id', SkillController.getSkillById);
router.put('/:id', SkillController.updateSkill);
router.delete('/:id', SkillController.deleteSkill);
router.post('/use', SkillController.useSkill);

export default router; 