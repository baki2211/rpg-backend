import { SessionService } from '../services/SessionService.js';
import { SessionParticipantService } from '../services/SessionParticipantService.js';
import { SessionLifecycleService } from '../services/SessionLifecycleService.js';
import { SessionQueryService } from '../services/SessionQueryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';

const sessionService = new SessionService();
const participantService = new SessionParticipantService();
const lifecycleService = new SessionLifecycleService();
const queryService = new SessionQueryService();

export class SessionController {
  static createSession = asyncHandler(async (req, res) => {
    const name = InputValidator.validateText(req.body.name, { maxLength: 100, required: true });
    res.json(await sessionService.createSession(name, InputValidator.validateLocationId(req.body.locationId)));
  });

  static getSession = asyncHandler(async (req, res) => {
    const session = await sessionService.getSession(InputValidator.validateId(req.params.id));
    if (!session) throw new HttpError(404, 'Session not found');
    res.json(session);
  });

  static getSessionByLocation = asyncHandler(async (req, res) => {
    const session = await sessionService.getSessionByLocation(InputValidator.validateLocationId(req.params.locationId));
    if (!session) throw new HttpError(404, 'Session not found');
    res.json(session);
  });

  static addParticipant = asyncHandler(async (req, res) => {
    res.json(await participantService.addParticipant(
      InputValidator.validateId(req.params.sessionId),
      InputValidator.validateCharacterId(req.body.characterId)
    ));
  });

  static removeParticipant = asyncHandler(async (req, res) => {
    await participantService.removeParticipant(
      InputValidator.validateId(req.params.sessionId),
      InputValidator.validateCharacterId(req.params.characterId)
    );
    res.status(204).end();
  });

  static getParticipants = asyncHandler(async (req, res) => {
    res.json(await participantService.getParticipants(InputValidator.validateId(req.params.sessionId)));
  });

  static getAllSessions = asyncHandler(async (req, res) => {
    res.json(await queryService.getAllSessions());
  });

  static getLocationParticipants = asyncHandler(async (req, res) => {
    res.json(await participantService.getLocationParticipants(InputValidator.validateLocationId(req.params.locationId)));
  });

  static updateSessionStatus = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.updateSessionStatus(InputValidator.validateId(req.params.sessionId), req.body.status));
  });

  static updateSessionActive = asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      throw new HttpError(400, 'isActive must be a boolean');
    }
    res.json(await sessionService.updateSessionActive(InputValidator.validateId(req.params.sessionId), isActive));
  });

  static getClosedSessions = asyncHandler(async (req, res) => {
    res.json(await queryService.getClosedSessions());
  });

  static getAllSessionsForLogs = asyncHandler(async (req, res) => {
    const limit = InputValidator.validateInteger(req.query.limit ?? 100, { min: 1, max: 2147483647 });
    res.json(await queryService.getAllSessionsForLogs(limit));
  });

  static freezeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.freezeSession(InputValidator.validateId(req.params.sessionId)));
  });

  static unfreezeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.unfreezeSession(InputValidator.validateId(req.params.sessionId)));
  });

  static closeSession = asyncHandler(async (req, res) => {
    res.json(await lifecycleService.closeSession(InputValidator.validateId(req.params.sessionId), req.body.reason));
  });
}
