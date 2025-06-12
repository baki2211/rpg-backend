import express from 'express';
import { RankController } from '../controllers/RankController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();
const rankController = new RankController();

router.use(authenticateToken);

router.get('/', rankController.getAllRanks.bind(rankController));
router.post('/', isAdmin, rankController.createRank.bind(rankController));
router.put('/:level', isAdmin, rankController.updateRank.bind(rankController));
router.delete('/delete/:level', isAdmin, rankController.deleteRank.bind(rankController));

export default router; 