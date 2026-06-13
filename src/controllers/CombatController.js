import { CombatService } from '../services/CombatService.js';
import { CombatActionService } from '../services/CombatActionService.js';
import { CombatResolutionService } from '../services/CombatResolutionService.js';
import { SessionService } from '../services/SessionService.js';
import { CharacterService } from '../services/CharacterService.js';
import { EventService } from '../services/EventService.js';
import { InputValidator } from '../utils/inputValidator.js';
import { AuditLogger } from '../utils/auditLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const combatService = new CombatService();
const combatActionService = new CombatActionService();
const combatResolutionService = new CombatResolutionService();
const sessionService = new SessionService();
const characterService = new CharacterService();
const eventService = new EventService();

export class CombatController {
    /**
     * Create a new combat round
     * POST /api/combat/rounds
     */
    static createRound = asyncHandler(async (req, res) => {
        const { locationId, eventId } = req.body;
        const userId = req.user.id;

        if (!locationId) {
            throw new HttpError(400, 'Location ID is required');
        }

        const session = await sessionService.getActiveSessionByLocation(locationId);
        const sessionId = session?.id || null;

        let finalEventId = eventId || null;
        if (!finalEventId) {
            const activeEvent = await eventService.getActiveEvent(locationId);
            finalEventId = activeEvent?.id || null;
        }

        const round = await combatService.createRound(
            parseInt(locationId),
            userId,
            sessionId,
            finalEventId
        );

        AuditLogger.logCombat(
            AuditLogger.EventTypes.COMBAT_ROUND_CREATE,
            userId,
            null,
            req,
            {
                round_id: round.id,
                location_id: parseInt(locationId),
                session_id: sessionId,
                event_id: finalEventId
            }
        );

        res.status(201).json({
            round: {
                id: round.id,
                roundNumber: round.roundNumber,
                status: round.status,
                sessionId: round.sessionId,
                eventId: round.eventId,
                createdAt: round.createdAt
            }
        });
    });

    /**
     * Submit a skill action to a round
     * POST /api/combat/rounds/:roundId/actions
     */
    static submitAction = asyncHandler(async (req, res) => {
        const roundId = InputValidator.validateRoundId(req.params.roundId);
        const skillId = InputValidator.validateSkillId(req.body.skillId);
        const targetId = req.body.targetId ? InputValidator.validateCharacterId(req.body.targetId) : null;
        const userId = InputValidator.validateUserId(req.user.id);

        const character = await characterService.getActiveCharacter(userId);
        if (!character) {
            throw new HttpError(404, 'No active character found');
        }

        const action = await combatActionService.submitAction(
            roundId,
            character.id,
            skillId,
            targetId
        );

        AuditLogger.logCombat(
            AuditLogger.EventTypes.COMBAT_ACTION,
            userId,
            character.id,
            req,
            {
                round_id: roundId,
                skill_id: skillId,
                target_id: targetId,
                action_id: action.id
            }
        );

        res.status(201).json({
            message: 'Action submitted successfully',
            action
        });
    });

    /**
     * Get active round for a location
     * GET /api/combat/rounds/active/:locationId
     */
    static getActiveRound = asyncHandler(async (req, res) => {
        const round = await combatService.getActiveRound(parseInt(req.params.locationId));
        res.json({ round });
    });

    /**
     * Get actions for a specific round
     * GET /api/combat/rounds/:roundId/actions
     */
    static getRoundActions = asyncHandler(async (req, res) => {
        const actions = await combatService.getRoundActions(parseInt(req.params.roundId));
        res.json({ actions });
    });

    /**
     * Resolve a combat round
     * POST /api/combat/rounds/:roundId/resolve
     */
    static resolveRound = asyncHandler(async (req, res) => {
        const roundId = parseInt(req.params.roundId);
        if (!roundId || roundId <= 0) {
            throw new HttpError(400, 'Invalid round ID');
        }

        const userId = req.user.id;
        const result = await combatResolutionService.resolveRound(roundId, userId);

        AuditLogger.logCombat(
            AuditLogger.EventTypes.COMBAT_ROUND_RESOLVE,
            userId,
            null,
            req,
            {
                round_id: roundId,
                round_number: result.roundNumber,
                resolved_by: userId
            }
        );

        res.status(200).json({
            message: `Combat round ${result.roundNumber} resolved successfully`,
            result
        });
    });

    /**
     * Cancel a combat round
     * POST /api/combat/rounds/:roundId/cancel
     */
    static cancelRound = asyncHandler(async (req, res) => {
        const round = await combatService.cancelRound(
            parseInt(req.params.roundId),
            req.user.id
        );
        res.json({
            message: 'Combat round cancelled successfully',
            round
        });
    });

    /**
     * Get resolved rounds for a location
     * GET /api/combat/rounds/resolved/:locationId
     */
    static getResolvedRounds = asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const rounds = await combatService.getResolvedRounds(
            parseInt(req.params.locationId),
            limit
        );
        res.json({ rounds });
    });
}
