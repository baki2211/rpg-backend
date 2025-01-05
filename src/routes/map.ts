import { Router } from 'express';
import { MapController } from '../controllers/mapController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = Router();

// Accessible to all logged-in users
router.get('/', authenticateToken, MapController.getAllMaps);

// Admin-only actions
router.post('/new', authenticateToken, isAdmin, MapController.createMap);
router.put('/:id', authenticateToken, isAdmin, MapController.updateMap);

export default router;
