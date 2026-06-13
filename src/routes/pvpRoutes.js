import express from 'express';
import { PvPController } from '../controllers/PvPController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/resolve', authenticateToken, PvPController.resolvePvPEncounter);
router.get('/character/:characterId/skills', authenticateToken, PvPController.getCharacterPvPSkills);
router.post('/simulate', authenticateToken, PvPController.simulateSkillOutput);

export default router;
