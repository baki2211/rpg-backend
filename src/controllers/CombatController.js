import { CombatService } from '../services/CombatService.js';
import { SessionService } from '../services/SessionService.js';
import { CharacterService } from '../services/CharacterService.js';

export class CombatController {
    static combatService = new CombatService();
    static sessionService = new SessionService();
    static characterService = new CharacterService();

    /**
     * Create a new combat round
     * POST /api/combat/rounds
     */
    static async createRound(req, res) {
        try {
            const { locationId } = req.body;
            const userId = req.user.id;

            // Verify user has master permissions
            if (!['master', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            if (!locationId) {
                return res.status(400).json({ error: 'Location ID is required' });
            }

            // Get session for this location
            const session = await CombatController.sessionService.getActiveSessionByLocation(locationId);
            const sessionId = session?.id || null;

            // Get active event for this location
            const { EventService } = await import('../services/EventService.js');
            const eventService = new EventService();
            const activeEvent = await eventService.getActiveEvent(locationId);
            const eventId = activeEvent?.id || null;

            const round = await CombatController.combatService.createRound(
                locationId, 
                userId, 
                sessionId,
                eventId
            );

            res.status(201).json({
                success: true,
                message: 'Combat round created successfully',
                round
            });
        } catch (error) {
            console.error('Error creating combat round:', error);
            res.status(500).json({ error: 'Failed to create combat round' });
        }
    }

    /**
     * Submit a skill action to a round
     * POST /api/combat/rounds/:roundId/actions
     */
    static async submitAction(req, res) {
        try {
            const { roundId } = req.params;
            const { skillId, targetId } = req.body;
            const userId = req.user.id;

            if (!skillId) {
                return res.status(400).json({ error: 'Skill ID is required' });
            }

            // Get the user's active character
            const character = await CombatController.characterService.getActiveCharacter(userId);
            if (!character) {
                return res.status(400).json({ error: 'No active character found' });
            }

            const action = await CombatController.combatService.submitAction(
                parseInt(roundId),
                character.id,
                skillId,
                targetId || null
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

            const result = await CombatController.combatService.resolveRound(
                parseInt(roundId),
                userId
            );

            res.json({
                success: true,
                message: 'Combat round resolved successfully',
                result
            });
        } catch (error) {
            console.error('Error resolving combat round:', error);
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