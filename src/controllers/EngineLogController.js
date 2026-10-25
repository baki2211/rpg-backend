import { EngineLogService } from '../services/EngineLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const engineLogService = new EngineLogService();

export class EngineLogController {
  static getLogsByLocation = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    const limit = InputValidator.validateLimit(req.query.limit, 50);
    const logs = await engineLogService.getLogsByLocation(locationId, limit);
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsBySession = asyncHandler(async (req, res) => {
    const sessionId = InputValidator.validateId(req.params.sessionId);
    const limit = InputValidator.validateLimit(req.query.limit, 50);
    const type = InputValidator.validateText(req.query.type, { maxLength: 20 });
    const logs = type
      ? await engineLogService.getLogsBySessionAndType(sessionId, type, limit)
      : await engineLogService.getLogsBySession(sessionId, limit);
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsByEvent = asyncHandler(async (req, res) => {
    const eventId = InputValidator.validateId(req.params.eventId);
    const logs = await engineLogService.getLogsByEvent(eventId);
    res.json({ success: true, logs, count: logs.length });
  });

  static clearOldLogs = asyncHandler(async (req, res) => {
    const daysOld = InputValidator.validateInteger(req.params.daysOld, { min: 1, max: 365 });
    const deletedCount = await engineLogService.clearOldLogs(daysOld);
    res.json({ success: true, message: `Deleted ${deletedCount} old engine logs`, deletedCount });
  });
}
