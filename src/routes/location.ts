import { Router } from 'express';
import { LocationController } from '../controllers/locationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = Router();

// Accessible to all logged-in users
router.get('/:mapId', authenticateToken, LocationController.getLocations);

// Admin-only actions
router.post('/:mapId/new', authenticateToken, isAdmin, LocationController.createLocation);
router.put('/:locationId', authenticateToken, isAdmin, LocationController.updateLocation);
router.delete('/:locationId', authenticateToken, isAdmin, LocationController.deleteLocation);

export default router;
