import { Router } from 'express';
import { MapController } from '../controllers/mapController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = Router();

router.post('/new', authenticateToken, isAdmin, upload.single('map'), MapController.createMap);
router.get('/', authenticateToken, MapController.getAllMaps);
router.get('/main', authenticateToken, MapController.getMainMap); 
router.get('/:id', authenticateToken, MapController.getMapById);
router.put('/:id', authenticateToken, isAdmin, upload.single('map'), MapController.updateMap);
router.delete('/:id', authenticateToken, isAdmin, MapController.deleteMap);
router.get('/:id/locations', authenticateToken, MapController.getLocationsByMapId);


export default router;

