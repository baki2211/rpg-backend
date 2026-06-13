import express from 'express';
import { RankController } from '../controllers/RankController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', RankController.getAllRanks);
router.post('/', isAdmin, RankController.createRank);
router.put('/:level', isAdmin, RankController.updateRank);
router.delete('/delete/:level', isAdmin, RankController.deleteRank);

export default router;
