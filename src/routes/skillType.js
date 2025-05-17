import express from 'express';
import { SkillTypeController } from '../controllers/SkillTypeController.js';

const router = express.Router();

router.get('/', SkillTypeController.getAllSkillTypes);
router.get('/:id', SkillTypeController.getSkillTypeById);
router.post('/', SkillTypeController.createSkillType);
router.put('/:id', SkillTypeController.updateSkillType);
router.delete('/:id', SkillTypeController.deleteSkillType);

export default router; 