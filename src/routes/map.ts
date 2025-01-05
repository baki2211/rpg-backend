import multer from 'multer';
import { Router } from 'express';
import { MapController } from '../controllers/mapController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname); // Create a unique filename
    },
});

const upload = multer({ storage });
const router = Router();

router.post('/new', authenticateToken, isAdmin, upload.single('map'), MapController.createMap);
router.get('/', authenticateToken, MapController.getAllMaps);
router.get('/:id', authenticateToken, MapController.getMapById);
router.put('/:id', authenticateToken, isAdmin, MapController.updateMap);
router.delete('/:id', authenticateToken, isAdmin, MapController.deleteMap);

export default router;
