import { EventService } from '../services/EventService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const eventService = new EventService();

export class EventController {
    static createEvent = asyncHandler(async (req, res) => {
        const { title, type, description, locationId } = req.body;
        if (!title || !type || !locationId) {
            throw new HttpError(400, 'Title, type, and locationId are required');
        }
        res.status(201).json(await eventService.createEvent(title, type, locationId, req.user.id, description));
    });

    static closeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.closeEvent(parseInt(req.params.eventId), req.user.id));
    });

    static freezeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.freezeEvent(parseInt(req.params.eventId), req.user.id));
    });

    static unfreezeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.unfreezeEvent(parseInt(req.params.eventId), req.user.id));
    });

    static getActiveEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.getActiveEvent(parseInt(req.params.locationId)));
    });

    static getEventsByLocation = asyncHandler(async (req, res) => {
        const { limit = 10, status } = req.query;
        res.json(await eventService.getEventsByLocation(
            parseInt(req.params.locationId),
            parseInt(limit),
            status
        ));
    });

    static getEventById = asyncHandler(async (req, res) => {
        const event = await eventService.getEventById(parseInt(req.params.eventId));
        if (!event) throw new HttpError(404, 'Event not found');
        res.json(event);
    });

    static getEventStatistics = asyncHandler(async (req, res) => {
        res.json(await eventService.getEventStatistics(parseInt(req.params.eventId)));
    });
}
