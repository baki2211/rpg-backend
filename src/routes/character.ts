import { Router } from 'express';
import { CharacterController } from '../controllers/characterController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/new', authenticateToken, CharacterController.createCharacter);
router.get('/', authenticateToken, CharacterController.getCharacters);
router.put('/:characterId/activate', authenticateToken, CharacterController.activateCharacter);
router.delete('/:characterId', authenticateToken, CharacterController.deleteCharacter);

export default router;
