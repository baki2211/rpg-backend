import { SessionService } from '../services/SessionService.js';
import { SessionParticipantService } from '../services/SessionParticipantService.js';
import { SessionLifecycleService } from '../services/SessionLifecycleService.js';
import { SessionQueryService } from '../services/SessionQueryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const sessionService = new SessionService();
const participantService = new SessionParticipantService();
const lifecycleService = new SessionLifecycleService();
const queryService = new SessionQueryService();

export class SessionController {
  static createSession = asyncHandler(async (req, res) => {
    const { name, locationId } = req.body;
    res.json(await sessionService.createSession(name, locationId));
  });

  static getSession = asyncHandler(async (req, res) => {
    const session = await sessionService.getSession(req.params.id);
    if (!session) throw new HttpError(404, 'Session not found');
    res.json(session);
  });

  static getSessionByLocation = asyncHandler(async (req, res) => {
    const session = await sessionService.getSessionByLocation(req.params.locationId);
    if (!session) throw new HttpError(404, 'Session not found');
    res.json(session);
  });

  static addParticipant = asyncHandler(async (req, res) => {
    const { characterId } = req.body;
    res.json(await participantService.addParticipant(req.params.sessionId, characterId));
  });

  static removeParticipant = asyncHandler(async (req, res) => {
    await participantService.removeParticipant(req.params.sessionId, req.params.characterId);
    res.status(204).end();
  });

  static getParticipants = asyncHandler(async (req, res) => {
    res.json(await participantService.getParticipants(req.params.sessionId));
  });

  static getAllSessions = asyncHandler(async (req, res) => {
    res.json(await queryService.getAllSessions());
  });

  static getLocationParticipants = asyncHandler(async (req, res) => {
    res.json(await participantService.getLocationParticipants(req.params.locationId));
  });

  static updateSessionStatus = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.updateSessionStatus(req.params.sessionId, req.body.status));
  });

  static updateSessionActive = asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new HttpError(400, 'isActive must be a boolean');
    }
    res.json(await sessionService.updateSessionActive(req.params.sessionId, isActive));
  });

  static getClosedSessions = asyncHandler(async (req, res) => {
    res.json(await queryService.getClosedSessions());
  });

  static getAllSessionsForLogs = asyncHandler(async (req, res) => {
    const { limit } = req.query;
    res.json(await queryService.getAllSessionsForLogs(limit ? parseInt(limit) : 100));
  });

  static freezeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.freezeSession(req.params.sessionId));
  });

  static unfreezeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.unfreezeSession(req.params.sessionId));
  });

  static closeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.closeSession(req.params.sessionId, req.body.reason));
  });
}
