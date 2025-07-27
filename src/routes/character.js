import express from 'express';
import { CharacterController } from '../controllers/characterController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();
const characterController = new CharacterController();

// Apply authentication to all routes
router.use(authenticateToken);


// NPC routes (admin/master only for management)
router.post('/npcs', characterController.createNPC.bind(characterController));
router.get('/npcs', characterController.getAllNPCs.bind(characterController));
router.put('/npcs/:id', characterController.updateNPC.bind(characterController));
router.delete('/npcs/:id', characterController.deleteNPC.bind(characterController));

// NPC activation routes (available to all users)
router.get('/npcs/available', characterController.getAvailableNPCs.bind(characterController));
router.get('/active-npc', characterController.getActiveNPC.bind(characterController));
router.post('/npcs/:id/activate', characterController.activateNPC.bind(characterController));
router.post('/npcs/:id/deactivate', characterController.deactivateNPC.bind(characterController));

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
router.get('/:id', characterController.getCharacterById.bind(characterController));
router.get('/:id/skills/available', CharacterController.getAvailableSkills);
router.get('/:id/skills/acquired', characterController.getAcquiredSkills.bind(characterController));
router.post('/:id/skills/:skillId/acquire', RateLimitMiddleware.skillUsageLimit, CharacterController.acquireSkill);
router.put('/:id/stats', RateLimitMiddleware.characterOperationLimit, CharacterController.updateCharacterStats);
router.get('/:id/stats/definitions', characterController.getCharacterStatsWithDefinitions.bind(characterController));

export default router;
