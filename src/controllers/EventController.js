import { EventService } from '../services/EventService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';

const eventService = new EventService();

export class EventController {
    static createEvent = asyncHandler(async (req, res) => {
        const { title, type, description, locationId } = req.body;
        if (!title || !type || !locationId) {
            throw new HttpError(400, 'Title, type, and locationId are required');
        }
        res.status(201).json(await eventService.createEvent(
            title, type, InputValidator.validateLocationId(locationId), req.user.id, description
        ));
    });

    static closeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.closeEvent(InputValidator.validateId(req.params.eventId), req.user.id));
    });

    static freezeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.freezeEvent(InputValidator.validateId(req.params.eventId), req.user.id));
    });

    static unfreezeEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.unfreezeEvent(InputValidator.validateId(req.params.eventId), req.user.id));
    });

    static getActiveEvent = asyncHandler(async (req, res) => {
        res.json(await eventService.getActiveEvent(InputValidator.validateLocationId(req.params.locationId)));
    });

    static getEventsByLocation = asyncHandler(async (req, res) => {
        const limit = InputValidator.validateInteger(req.query.limit ?? 10, { min: 1, max: 2147483647 });
        res.json(await eventService.getEventsByLocation(
            InputValidator.validateLocationId(req.params.locationId),
            limit,
            InputValidator.validateText(req.query.status, { maxLength: 20 })
        ));
    });

    static getEventById = asyncHandler(async (req, res) => {
        const event = await eventService.getEventById(InputValidator.validateId(req.params.eventId));
        if (!event) throw new HttpError(404, 'Event not found');
        res.json(event);
    });

    static getEventStatistics = asyncHandler(async (req, res) => {
        res.json(await eventService.getEventStatistics(InputValidator.validateId(req.params.eventId)));
    });
}
