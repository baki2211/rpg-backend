import express from 'express';
import { CharacterController } from '../controllers/CharacterController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);


// NPC routes (admin/master only for management)
router.post('/npcs', CharacterController.createNPC);
router.get('/npcs', CharacterController.getAllNPCs);
router.put('/npcs/:id', CharacterController.updateNPC);
router.delete('/npcs/:id', CharacterController.deleteNPC);

// NPC activation routes (available to all users)
router.get('/npcs/available', CharacterController.getAvailableNPCs);
router.get('/active-npc', CharacterController.getActiveNPC);
router.post('/npcs/:id/activate', CharacterController.activateNPC);
router.post('/npcs/:id/deactivate', CharacterController.deactivateNPC);

// Character creation
router.post('/new', RateLimitMiddleware.characterOperationLimit, upload.single('image'), CharacterController.createCharacter);
router.post('/', RateLimitMiddleware.characterOperationLimit, upload.single('image'), CharacterController.createCharacter);

// Regular character routes (specific routes first)
router.get('/all', CharacterController.getAllCharacters);
router.get('/', CharacterController.getCharacters);
router.put('/:id/activate', RateLimitMiddleware.characterOperationLimit, CharacterController.activateCharacter);
router.delete('/:id', RateLimitMiddleware.characterOperationLimit, CharacterController.deleteCharacter);
router.delete('/:id/delete', RateLimitMiddleware.characterOperationLimit, CharacterController.deleteCharacter);

// Character image management
router.post('/:characterId/image', upload.single('image'), CharacterController.uploadCharacterImage);
router.delete('/:characterId/image', CharacterController.deleteCharacterImage);

// Character detail routes (keep parameterized routes at the end)
router.get('/:id', CharacterController.getCharacterById);
router.get('/:id/skills/available', CharacterController.getAvailableSkills);
router.get('/:id/skills/acquired', CharacterController.getAcquiredSkills);
router.post('/:id/skills/:skillId/acquire', RateLimitMiddleware.skillUsageLimit, CharacterController.acquireSkill);
router.put('/:id/stats', RateLimitMiddleware.characterOperationLimit, CharacterController.updateCharacterStats);
router.get('/:id/stats/definitions', CharacterController.getCharacterStatsWithDefinitions);

export default router;
