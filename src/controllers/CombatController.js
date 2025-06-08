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
            const { locationId, eventId } = req.body;  // Accept eventId from request
            const userId = req.user.id;

            console.log(`⚔️ CONTROLLER: Creating round for location ${locationId}, eventId: ${eventId}`);

            // Verify user has master permissions
            if (!['master', 'admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            if (!locationId) {
                return res.status(400).json({ error: 'Location ID is required' });
            }

            // Get session for this location (or let CombatService create one)
            const session = await CombatController.sessionService.getActiveSessionByLocation(locationId);
            const sessionId = session?.id || null;
            console.log(`⚔️ CONTROLLER: Found session ${sessionId} for location ${locationId}`);

            // Use provided eventId, or fall back to looking up active event
            let finalEventId = eventId;
            if (!finalEventId) {
                console.log(`⚔️ CONTROLLER: No eventId provided, looking up active event`);
                const { EventService } = await import('../services/EventService.js');
                const eventService = new EventService();
                const activeEvent = await eventService.getActiveEvent(locationId);
                finalEventId = activeEvent?.id || null;
            }
            console.log(`⚔️ CONTROLLER: Using eventId ${finalEventId} for round creation`);

            const round = await CombatController.combatService.createRound(
                locationId, 
                userId, 
                sessionId,
                finalEventId
            );

            console.log(`⚔️ CONTROLLER: Successfully created round ${round.id}`);

            res.status(201).json({
                success: true,
                message: 'Combat round created successfully',
                round
            });
        } catch (error) {
            console.error('⚔️ CONTROLLER: Error creating combat round:', error);
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

            console.log(`⚔️ CONTROLLER: Resolving round ${roundId} by user ${userId}`);

            // Verify user has master permissions
            if (!['master', 'admin'].includes(req.user.role)) {
                console.log(`⚔️ CONTROLLER: User ${userId} lacks permissions (role: ${req.user.role})`);
                return res.status(403).json({ 
                    success: false, 
                    error: 'Insufficient permissions. Only masters and admins can resolve combat rounds.' 
                });
            }

            if (!roundId || isNaN(parseInt(roundId))) {
                console.log(`⚔️ CONTROLLER: Invalid round ID: ${roundId}`);
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid round ID provided' 
                });
            }

            const roundIdInt = parseInt(roundId);
            console.log(`⚔️ CONTROLLER: Calling CombatService.resolveRound for round ${roundIdInt}`);

            const result = await CombatController.combatService.resolveRound(roundIdInt, userId);
            
            console.log(`⚔️ CONTROLLER: Round ${roundIdInt} resolved successfully`);
            res.json({ 
                success: true, 
                resolution: result,
                message: `Combat round ${result.roundNumber} resolved successfully`
            });
        } catch (error) {
            console.error('⚔️ CONTROLLER: Error in resolveRound:', {
                message: error.message,
                stack: error.stack,
                roundId: req.params.roundId,
                userId: req.user?.id
            });

            // Handle specific error types
            if (error.message.includes('not found') || error.message.includes('not active')) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Combat round not found or not active',
                    details: error.message
                });
            }

            if (error.message.includes('No actions')) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No actions submitted for this round',
                    details: error.message
                });
            }

            if (error.message.includes('Failed to resolve clash')) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error during clash resolution',
                    details: error.message
                });
            }

            if (error.message.includes('Failed to process independent action')) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Error processing independent actions',
                    details: error.message
                });
            }

            if (error.message.includes('Failed to mark actions') || error.message.includes('Failed to update round')) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Database error during round resolution',
                    details: error.message
                });
            }

            // Generic server error for unhandled cases
            res.status(500).json({ 
                success: false, 
                error: 'Internal server error during combat resolution',
                details: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
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