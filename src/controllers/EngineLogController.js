import { EngineLogService } from '../services/EngineLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const engineLogService = new EngineLogService();

export class EngineLogController {
  static getLogsByLocation = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    const { limit = 50 } = req.query;
    const logs = await engineLogService.getLogsByLocation(locationId, parseInt(limit));
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsBySession = asyncHandler(async (req, res) => {
    const sessionId = InputValidator.validateId(req.params.sessionId);
    const { limit = 50, type } = req.query;
    const logs = type
      ? await engineLogService.getLogsBySessionAndType(sessionId, type, parseInt(limit))
      : await engineLogService.getLogsBySession(sessionId, parseInt(limit));
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsByEvent = asyncHandler(async (req, res) => {
    const eventId = InputValidator.validateId(req.params.eventId);
    const logs = await engineLogService.getLogsByEvent(eventId);
    res.json({ success: true, logs, count: logs.length });
  });

  static clearOldLogs = asyncHandler(async (req, res) => {
    const daysOld = InputValidator.validateInteger(req.params.daysOld, { min: 1 });
    const deletedCount = await engineLogService.clearOldLogs(daysOld);
    res.json({ success: true, message: `Deleted ${deletedCount} old engine logs`, deletedCount });
  });
}
