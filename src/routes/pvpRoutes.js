import express from 'express';
import { PvPController } from '../controllers/pvpController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const pvpController = new PvPController();

// Resolve PvP encounter between two characters
router.post('/resolve', authenticateToken, (req, res) => pvpController.resolvePvPEncounter(req, res));

// Get available PvP skills for a character
router.get('/character/:characterId/skills', authenticateToken, (req, res) => pvpController.getCharacterPvPSkills(req, res));

// Simulate skill output (for testing/preview)
router.post('/simulate', authenticateToken, (req, res) => pvpController.simulateSkillOutput(req, res));

export default router; 