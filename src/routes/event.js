import express from 'express';
import { EventController } from '../controllers/EventController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
const eventController = new EventController();

// All routes require authentication
router.use(requireAuth);

/**
 * @route POST /api/events
 * @desc Create a new event
 * @access Master/Admin only
 */
router.post('/', requireRole(['master', 'admin']), async (req, res) => {
    await eventController.createEvent(req, res);
});

/**
 * @route POST /api/events/:eventId/close
 * @desc Close an active event
 * @access Master/Admin only
 */
router.post('/:eventId/close', requireRole(['master', 'admin']), async (req, res) => {
    await eventController.closeEvent(req, res);
});

/**
 * @route POST /api/events/:eventId/freeze
 * @desc Freeze an active event
 * @access Master/Admin only
 */
router.post('/:eventId/freeze', requireRole(['master', 'admin']), async (req, res) => {
    await eventController.freezeEvent(req, res);
});

/**
 * @route POST /api/events/:eventId/unfreeze
 * @desc Unfreeze an active event
 * @access Master/Admin only
 */
router.post('/:eventId/unfreeze', requireRole(['master', 'admin']), async (req, res) => {
    await eventController.unfreezeEvent(req, res);
});

/**
 * @route GET /api/events/active/:locationId
 * @desc Get active event for a location
 * @access All authenticated users
 */
router.get('/active/:locationId', async (req, res) => {
    await eventController.getActiveEvent(req, res);
});

/**
 * @route GET /api/events/location/:locationId
 * @desc Get events by location
 * @access All authenticated users
 */
router.get('/location/:locationId', async (req, res) => {
    await eventController.getEventsByLocation(req, res);
});

/**
 * @route GET /api/events/:eventId
 * @desc Get event by ID with details
 * @access All authenticated users
 */
router.get('/:eventId', async (req, res) => {
    await eventController.getEventById(req, res);
});

/**
 * @route GET /api/events/:eventId/statistics
 * @desc Get event statistics
 * @access Master/Admin only
 */
router.get('/:eventId/statistics', requireRole(['master', 'admin']), async (req, res) => {
    await eventController.getEventStatistics(req, res);
});

export default router; 