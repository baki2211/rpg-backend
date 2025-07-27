import { CombatService } from '../services/CombatService.js';
import { SessionService } from '../services/SessionService.js';
import { CharacterService } from '../services/CharacterService.js';
import { EventService } from '../services/EventService.js';
import { InputValidator } from '../utils/inputValidator.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { AuditLogger } from '../utils/auditLogger.js';

export class CombatController {
    static combatService = new CombatService();
    static sessionService = new SessionService();
    static characterService = new CharacterService();
    static eventService = new EventService();

    /**
     * Create a new combat round
     * POST /api/combat/rounds
     */
    static async createRound(req, res) {
        try {
            const { locationId, eventId } = req.body;
            const userId = req.user.id;

            if (!locationId) {
                return res.status(400).json({ error: 'Location ID is required' });
            }

            // Find session for this location
            const sessionService = new SessionService();
            const session = await sessionService.getActiveSessionByLocation(locationId);
            let sessionId = session?.id || null;

            if (session) {
                sessionId = session.id;
            }

            // Try to get eventId from request, or look up active event
            let finalEventId = eventId;
            if (!finalEventId) {
                try {
                    const activeEvent = await CombatController.eventService.getActiveEvent(locationId);
                    finalEventId = activeEvent?.id || null;
                } catch (eventError) {
                    // If event lookup fails, continue without event
                    finalEventId = null;
                }
            }

            const round = await CombatController.combatService.createRound(
                parseInt(locationId),
                userId,
                sessionId,
                finalEventId
            );
            
            // Log combat round creation
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
                success: true,
                round: {
                    id: round.id,
                    roundNumber: round.roundNumber,
                    status: round.status,
                    sessionId: round.sessionId,
                    eventId: round.eventId,
                    createdAt: round.createdAt
                }
            });
        } catch (error) {
            res.status(500).json({ 
                error: error.message || 'Failed to create combat round' 
            });
        }
    }

    /**
     * Submit a skill action to a round
     * POST /api/combat/rounds/:roundId/actions
     */
    static async submitAction(req, res) {
        try {
            // Validate and sanitize inputs
            const roundId = InputValidator.validateRoundId(req.params.roundId);
            const skillId = InputValidator.validateSkillId(req.body.skillId);
            const targetId = req.body.targetId ? InputValidator.validateCharacterId(req.body.targetId) : null;
            const userId = InputValidator.validateUserId(req.user.id);

            // Get the user's active character
            const character = await CombatController.characterService.getActiveCharacter(userId);
            if (!character) {
                return res.status(400).json({ error: 'No active character found' });
            }

            // Submit the action with validated inputs
            const action = await CombatController.combatService.submitAction(
                roundId,
                character.id,
                skillId,
                targetId
            );
            
            // Log combat action
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
                success: true,
                message: 'Action submitted successfully',
                action
            });
        } catch (error) {
            console.error('Error submitting action:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to submit action'
            });
        }
    }

    /**
     * Get active round for a location
     * GET /api/combat/rounds/active/:locationId
     */
    static async getActiveRound(req, res) {
        try {
            const { locationId } = req.params;

            const round = await CombatController.combatService.getActiveRound(
                parseInt(locationId)
            );

            res.json({
                success: true,
                round
            });
        } catch (error) {
            console.error('Error getting active round:', error);
            res.status(500).json({ error: 'Failed to get active round' });
        }
    }

    /**
     * Get actions for a specific round
     * GET /api/combat/rounds/:roundId/actions
     */
    static async getRoundActions(req, res) {
        try {
            const { roundId } = req.params;

            const actions = await CombatController.combatService.getRoundActions(
                parseInt(roundId)
            );

            res.json({
                success: true,
                actions
            });
        } catch (error) {
            console.error('Error getting round actions:', error);
            res.status(500).json({ error: 'Failed to get round actions' });
        }
    }

    /**
     * Resolve a combat round
     * POST /api/combat/rounds/:roundId/resolve
     */
    static async resolveRound(req, res) {
        try {
            const { roundId } = req.params;
            const userId = req.user.id;

            // Verify user has master permissions
            if (!['master', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Validate roundId
            const roundIdInt = parseInt(roundId);
            if (!roundIdInt || roundIdInt <= 0) {
                return res.status(400).json({ error: 'Invalid round ID' });
            }

            // Resolve the round
            const result = await CombatController.combatService.resolveRound(roundIdInt, userId);
            
            // Log combat round resolution
            AuditLogger.logCombat(
                AuditLogger.EventTypes.COMBAT_ROUND_RESOLVE,
                userId,
                null,
                req,
                {
                    round_id: roundIdInt,
                    round_number: result.roundNumber,
                    resolved_by: userId
                }
            );

            res.status(200).json({
                success: true,
                message: `Combat round ${result.roundNumber} resolved successfully`,
                result
            });
        } catch (error) {
            res.status(500).json({ 
                error: error.message || 'Failed to resolve combat round' 
            });
        }
    }

    /**
     * Cancel a combat round
     * POST /api/combat/rounds/:roundId/cancel
     */
    static async cancelRound(req, res) {
        try {
            const { roundId } = req.params;
            const userId = req.user.id;

            // Verify user has master permissions
            if (!['master', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            const round = await CombatController.combatService.cancelRound(
                parseInt(roundId),
                userId
            );

            res.json({
                success: true,
                message: 'Combat round cancelled successfully',
                round
            });
        } catch (error) {
            console.error('Error cancelling combat round:', error);
            res.status(500).json({ error: 'Failed to cancel combat round' });
        }
    }

    /**
     * Get resolved rounds for a location
     * GET /api/combat/rounds/resolved/:locationId
     */
    static async getResolvedRounds(req, res) {
        try {
            const { locationId } = req.params;
            const limit = parseInt(req.query.limit) || 10;

            const rounds = await CombatController.combatService.getResolvedRounds(
                parseInt(locationId),
                limit
            );

            res.json({
                success: true,
                rounds
            });
        } catch (error) {
            console.error('Error getting resolved rounds:', error);
            res.status(500).json({ error: 'Failed to get resolved rounds' });
        }
    }
} 