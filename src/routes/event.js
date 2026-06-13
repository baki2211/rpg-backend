import express from 'express';
import { EventController } from '../controllers/EventController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const masterOrAdmin = requireRole(['master', 'admin']);

router.use(requireAuth);

router.post('/', masterOrAdmin, EventController.createEvent);
router.post('/:eventId/close', masterOrAdmin, EventController.closeEvent);
router.post('/:eventId/freeze', masterOrAdmin, EventController.freezeEvent);
router.post('/:eventId/unfreeze', masterOrAdmin, EventController.unfreezeEvent);

router.get('/active/:locationId', EventController.getActiveEvent);
router.get('/location/:locationId', EventController.getEventsByLocation);
router.get('/:eventId', EventController.getEventById);
router.get('/:eventId/statistics', masterOrAdmin, EventController.getEventStatistics);

export default router;
