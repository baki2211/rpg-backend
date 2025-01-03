import express, { Router } from 'express';
import { getPlayers, createPlayer } from '../controllers/playerController.js';

const router: Router = express.Router();

router.get('/', getPlayers);
router.post('/', createPlayer);

export default router;
