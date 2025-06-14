import { EventService } from '../services/EventService.js';

export class EventController {
    constructor() {
        this.eventService = new EventService();
    }

    /**
     * Create a new event
     */
    async createEvent(req, res) {
        try {
            const { title, type, description, locationId } = req.body;
            const createdBy = req.user.id;

            if (!title || !type || !locationId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Title, type, and locationId are required' 
                });
            }

            const result = await this.eventService.createEvent(title, type, locationId, createdBy, description);

            res.status(201).json({
                success: true,
                event: result.event,
                session: result.session,
                transformation: result.transformation
            });
        } catch (error) {
            console.error('Error creating event:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Close an active event
     */
    async closeEvent(req, res) {
        try {
            const { eventId } = req.params;
            const closedBy = req.user.id;

            const result = await this.eventService.closeEvent(parseInt(eventId), closedBy);

            res.json({
                success: true,
                event: result.event,
                session: result.session,
                transformation: result.transformation
            });
        } catch (error) {
            console.error('Error closing event:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Freeze an event
     */
    async freezeEvent(req, res) {
        try {
            const { eventId } = req.params;
            const frozenBy = req.user.id;

            const result = await this.eventService.freezeEvent(parseInt(eventId), frozenBy);

            res.json({
                success: true,
                event: result.event,
                session: result.session,
                action: result.action
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Unfreeze an event
     */
    async unfreezeEvent(req, res) {
        try {
            const { eventId } = req.params;
            const unfrozenBy = req.user.id;

            const result = await this.eventService.unfreezeEvent(parseInt(eventId), unfrozenBy);

            res.json({
                success: true,
                event: result.event,
                session: result.session,
                action: result.action
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get active event for a location
     */
    async getActiveEvent(req, res) {
        try {
            const { locationId } = req.params;

            const event = await this.eventService.getActiveEvent(parseInt(locationId));

            res.json({ 
                success: true, 
                event 
            });
        } catch (error) {
            console.error('Error getting active event:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Get events by location
     */
    async getEventsByLocation(req, res) {
        try {
            const { locationId } = req.params;
            const { limit = 10, status } = req.query;

            const events = await this.eventService.getEventsByLocation(
                parseInt(locationId),
                parseInt(limit),
                status
            );

            res.json({ 
                success: true, 
                events 
            });
        } catch (error) {
            console.error('Error getting events by location:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Get event by ID with details
     */
    async getEventById(req, res) {
        try {
            const { eventId } = req.params;

            const event = await this.eventService.getEventById(parseInt(eventId));

            if (!event) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Event not found' 
                });
            }

            res.json({ 
                success: true, 
                event 
            });
        } catch (error) {
            console.error('Error getting event by ID:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Get event statistics
     */
    async getEventStatistics(req, res) {
        try {
            const { eventId } = req.params;

            const statistics = await this.eventService.getEventStatistics(parseInt(eventId));

            res.json({ 
                success: true, 
                statistics 
            });
        } catch (error) {
            console.error('Error getting event statistics:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
} 