import { Router } from 'express';
import { CharacterSkillsController } from '../controllers/characterSkillsController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Get available skills for a character
router.get('/:characterId/available-skills', authenticateToken, CharacterSkillsController.getAvailableSkills);

// Get acquired skills for a character
router.get('/:characterId/acquired-skills', authenticateToken, CharacterSkillsController.getAcquiredSkills);

// Acquire a skill for a character
router.post('/:skillId', authenticateToken, CharacterSkillsController.acquireSkill);

export default router; 