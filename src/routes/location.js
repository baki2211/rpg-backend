import { Router } from 'express';
import { LocationController } from '../controllers/locationController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = Router();

// Admin-only actions
router.post('/:mapId/new', (req, _res, next) => {
    console.log('Route matched for POST /api/locations/:mapId/new', req.params);
    next();
  }, authenticateToken, isAdmin, LocationController.createLocation);
router.get('/:mapId', authenticateToken, LocationController.getLocations); // Accessible to all logged-in users
router.put('/:locationId', authenticateToken, isAdmin, LocationController.updateLocation);
router.delete('/:locationId', authenticateToken, isAdmin, LocationController.deleteLocation);

export default router;
