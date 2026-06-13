import { EngineLogService } from '../services/EngineLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const engineLogService = new EngineLogService();

export class EngineLogController {
  static getLogsByLocation = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    const { limit = 50 } = req.query;
    const logs = await engineLogService.getLogsByLocation(parseInt(locationId), parseInt(limit));
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsBySession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { limit = 50, type } = req.query;
    const logs = type
      ? await engineLogService.getLogsBySessionAndType(parseInt(sessionId), type, parseInt(limit))
      : await engineLogService.getLogsBySession(parseInt(sessionId), parseInt(limit));
    res.json({ success: true, logs, count: logs.length });
  });

  static getLogsByEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const logs = await engineLogService.getLogsByEvent(parseInt(eventId));
    res.json({ success: true, logs, count: logs.length });
  });

  static clearOldLogs = asyncHandler(async (req, res) => {
    if (!['admin'].includes(req.user.role)) {
      throw new HttpError(403, 'Admin permissions required');
    }
    const { daysOld } = req.params;
    if (!daysOld || parseInt(daysOld) < 1) {
      throw new HttpError(400, 'Valid days parameter is required (minimum 1)');
    }
    const deletedCount = await engineLogService.clearOldLogs(parseInt(daysOld));
    res.json({ success: true, message: `Deleted ${deletedCount} old engine logs`, deletedCount });
  });
}
