import { Router } from 'express';
import { CharacterController } from '../controllers/characterController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/new', authenticateToken, upload.single('image'), CharacterController.createCharacter);
router.post('/characters/:characterId/image', upload.single('image'), CharacterController.uploadCharacterImage);
router.delete('/characters/:characterId/image', CharacterController.deleteCharacterImage);
router.get('/', authenticateToken, CharacterController.getCharacters);
router.put('/:characterId/activate', authenticateToken, CharacterController.activateCharacter);
router.delete('/:id/delete', authenticateToken, CharacterController.deleteCharacter);
router.post('/characters', upload.single('image'), CharacterController.createCharacter);
router.get('/characters', CharacterController.getCharacters);
router.post('/characters/:id/activate', CharacterController.activateCharacter);
router.delete('/characters/:id', CharacterController.deleteCharacter);
router.post('/characters/skills/:skillId', authenticateToken, CharacterController.acquireSkill);

export default router;
