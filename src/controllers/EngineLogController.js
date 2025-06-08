import { EngineLogService } from '../services/EngineLogService.js';

export class EngineLogController {
    static engineLogService = new EngineLogService();

    /**
     * Get engine logs for a location (current active session)
     * GET /api/engine-logs/location/:locationId
     */
    static async getLogsByLocation(req, res) {
        try {
            const { locationId } = req.params;
            const { limit = 50 } = req.query;

            if (!locationId) {
                return res.status(400).json({ error: 'Location ID is required' });
            }

            const logs = await EngineLogController.engineLogService.getLogsByLocation(
                parseInt(locationId),
                parseInt(limit)
            );

            res.json({
                success: true,
                logs,
                count: logs.length
            });
        } catch (error) {
            console.error('Error fetching engine logs by location:', error);
            res.status(500).json({ error: 'Failed to fetch engine logs' });
        }
    }

    /**
     * Get engine logs for a specific session
     * GET /api/engine-logs/session/:sessionId
     */
    static async getLogsBySession(req, res) {
        try {
            const { sessionId } = req.params;
            const { limit = 50, type } = req.query;

            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }

            let logs;
            if (type) {
                logs = await EngineLogController.engineLogService.getLogsBySessionAndType(
                    parseInt(sessionId),
                    type,
                    parseInt(limit)
                );
            } else {
                logs = await EngineLogController.engineLogService.getLogsBySession(
                    parseInt(sessionId),
                    parseInt(limit)
                );
            }

            res.json({
                success: true,
                logs,
                count: logs.length
            });
        } catch (error) {
            console.error('Error fetching engine logs by session:', error);
            res.status(500).json({ error: 'Failed to fetch engine logs' });
        }
    }

    /**
     * Get engine logs for an event
     * GET /api/engine-logs/event/:eventId
     */
    static async getLogsByEvent(req, res) {
        try {
            const { eventId } = req.params;

            if (!eventId) {
                return res.status(400).json({ error: 'Event ID is required' });
            }

            const logs = await EngineLogController.engineLogService.getLogsByEvent(
                parseInt(eventId)
            );

            res.json({
                success: true,
                logs,
                count: logs.length
            });
        } catch (error) {
            console.error('Error fetching engine logs by event:', error);
            res.status(500).json({ error: 'Failed to fetch engine logs' });
        }
    }

    /**
     * Clear old engine logs
     * DELETE /api/engine-logs/cleanup/:daysOld
     */
    static async clearOldLogs(req, res) {
        try {
            const { daysOld } = req.params;

            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin permissions required' });
            }

            if (!daysOld || parseInt(daysOld) < 1) {
                return res.status(400).json({ error: 'Valid days parameter is required (minimum 1)' });
            }

            const deletedCount = await EngineLogController.engineLogService.clearOldLogs(
                parseInt(daysOld)
            );

            res.json({
                success: true,
                message: `Deleted ${deletedCount} old engine logs`,
                deletedCount
            });
        } catch (error) {
            console.error('Error clearing old engine logs:', error);
            res.status(500).json({ error: 'Failed to clear old logs' });
        }
    }
} 