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

export default router;
