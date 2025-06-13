import { Router } from 'express';
import { CharacterController } from '../controllers/characterController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

// Character creation
router.post('/new', authenticateToken, upload.single('image'), CharacterController.createCharacter);
router.post('/', authenticateToken, upload.single('image'), CharacterController.createCharacter);

// Character image management
router.post('/:characterId/image', authenticateToken, upload.single('image'), CharacterController.uploadCharacterImage);
router.delete('/:characterId/image', authenticateToken, CharacterController.deleteCharacterImage);

// Character management
router.get('/all', authenticateToken, CharacterController.getAllCharacters); // Admin route - must come before '/'
router.get('/', authenticateToken, CharacterController.getCharacters);
router.put('/:characterId/activate', authenticateToken, CharacterController.activateCharacter);
router.post('/:id/activate', authenticateToken, CharacterController.activateCharacter);
router.delete('/:id/delete', authenticateToken, CharacterController.deleteCharacter);
router.delete('/:id', authenticateToken, CharacterController.deleteCharacter);

// Character skills
router.post('/skills/:skillId', authenticateToken, CharacterController.acquireSkill);
router.get('/:characterId/available-skills', authenticateToken, CharacterController.getAvailableSkills);

// Character stats management
router.get('/:characterId/stats', authenticateToken, CharacterController.getCharacterStats);
router.put('/:characterId/stats', authenticateToken, CharacterController.updateCharacterStats);
router.post('/:characterId/stats/reset', authenticateToken, CharacterController.resetCharacterStats);

export default router;
