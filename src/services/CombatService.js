import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { SkillEngine } from './SkillEngine.js';
import { PvPResolutionService } from './PvPResolutionService.js';
import { SkillUsageService } from './SkillUsageService.js';

export class CombatService {
    constructor() {
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.actionRepository = AppDataSource.getRepository(CombatAction);
        this.characterRepository = AppDataSource.getRepository(Character);
        this.skillRepository = AppDataSource.getRepository(Skill);
    }

    /**
     * Create a new combat round
     * @param {number} locationId - The location where combat is taking place
     * @param {number} createdBy - User ID of the master creating the round
     * @param {number} sessionId - Optional session ID
     * @param {number} eventId - Optional event ID
     * @returns {Promise<Object>} The created combat round
     */
    async createRound(locationId, createdBy, sessionId = null, eventId = null) {
        // Get the next round number for this location
        const lastRound = await this.roundRepository.findOne({
            where: { locationId },
            order: { roundNumber: 'DESC' }
        });

        const roundNumber = lastRound ? lastRound.roundNumber + 1 : 1;

        const round = this.roundRepository.create({
            roundNumber,
            locationId,
            sessionId,
            eventId,
            createdBy,
            status: 'active'
        });

        return await this.roundRepository.save(round);
    }

    /**
     * Submit a skill action to an active round
     * @param {number} roundId - The combat round ID
     * @param {number} characterId - The character performing the action
     * @param {number} skillId - The skill being used
     * @param {number} targetId - The target character (null for self/area skills)
     * @returns {Promise<Object>} The created combat action
     */
    async submitAction(roundId, characterId, skillId, targetId = null) {
        // Verify round exists and is active
        const round = await this.roundRepository.findOne({
            where: { id: roundId, status: 'active' }
        });

        if (!round) {
            throw new Error('Combat round not found or not active');
        }

        // Get character and skill data
        const [character, skill, target] = await Promise.all([
            this.characterRepository.findOne({
                where: { id: characterId },
                relations: ['race']
            }),
            this.skillRepository.findOne({
                where: { id: skillId },
                relations: ['branch', 'type']
            }),
            targetId ? this.characterRepository.findOne({ where: { id: targetId } }) : null
        ]);

        if (!character) throw new Error('Character not found');
        if (!skill) throw new Error('Skill not found');
        if (targetId && !target) throw new Error('Target character not found');

        // Calculate skill output using SkillEngine
        const skillEngine = new SkillEngine(character, skill);
        const finalOutput = await skillEngine.computeFinalOutput();
        const outcomeMultiplier = skillEngine.rollOutcome();

        // Determine roll quality
        let rollQuality = 'Standard';
        if (outcomeMultiplier <= 0.6) rollQuality = 'Poor';
        else if (outcomeMultiplier >= 1.4) rollQuality = 'Critical';

        // Check if character already has an action in this round
        const existingAction = await this.actionRepository.findOne({
            where: { roundId, characterId }
        });

        if (existingAction) {
            throw new Error('Character has already submitted an action for this round');
        }

        // Create the combat action
        const action = this.actionRepository.create({
            roundId,
            characterId,
            skillId,
            targetId,
            finalOutput,
            outcomeMultiplier,
            rollQuality,
            skillData: {
                id: skill.id,
                name: skill.name,
                type: skill.type?.name || 'Unknown',
                branch: skill.branch?.name || 'Unknown',
                target: skill.target,
                basePower: skill.basePower
            },
            characterData: {
                id: character.id,
                name: character.name,
                stats: character.stats
            },
            targetData: target ? {
                id: target.id,
                name: target.name
            } : null
        });

        const savedAction = await this.actionRepository.save(action);

        // Increment skill usage
        await SkillUsageService.incrementSkillUsage(characterId, skillId, skill.branchId);

        return savedAction;
    }

    /**
     * Get all actions for a specific round
     * @param {number} roundId - The combat round ID
     * @returns {Promise<Array>} Array of combat actions
     */
    async getRoundActions(roundId) {
        return await this.actionRepository.find({
            where: { roundId },
            relations: ['character', 'skill', 'target'],
            order: { submittedAt: 'ASC' }
        });
    }

    /**
     * Get active round for a location
     * @param {number} locationId - The location ID
     * @returns {Promise<Object|null>} The active round or null
     */
    async getActiveRound(locationId) {
        return await this.roundRepository.findOne({
            where: { locationId, status: 'active' },
            relations: ['actions', 'actions.character', 'actions.skill', 'actions.target']
        });
    }

    /**
     * Resolve a combat round
     * @param {number} roundId - The combat round ID
     * @param {number} resolvedBy - User ID of the master resolving the round
     * @returns {Promise<Object>} Resolution result
     */
    async resolveRound(roundId, resolvedBy) {
        return await AppDataSource.transaction(async (manager) => {
            const roundRepo = manager.getRepository(CombatRound);
            const actionRepo = manager.getRepository(CombatAction);

            // Get the round and its actions
            const round = await roundRepo.findOne({
                where: { id: roundId, status: 'active' },
                relations: ['actions', 'actions.character', 'actions.skill', 'actions.target']
            });

            if (!round) {
                throw new Error('Combat round not found or not active');
            }

            const actions = round.actions || [];
            if (actions.length === 0) {
                throw new Error('No actions to resolve');
            }

            // Group actions for clash resolution
            const { clashes, independentActions } = this.identifyClashes(actions);
            
            const resolutionResults = {
                roundId,
                roundNumber: round.roundNumber,
                clashes: [],
                independentActions: [],
                summary: {
                    totalActions: actions.length,
                    clashCount: clashes.length,
                    independentCount: independentActions.length
                }
            };

            // Resolve clashes
            for (const clash of clashes) {
                const clashResult = await this.resolveClash(clash, manager);
                resolutionResults.clashes.push(clashResult);
            }

            // Process independent actions
            for (const action of independentActions) {
                const independentResult = this.processIndependentAction(action);
                resolutionResults.independentActions.push(independentResult);
            }

            // Mark actions as processed
            await actionRepo.update(
                { roundId },
                { processed: true }
            );

            // Update round status
            await roundRepo.update(
                { id: roundId },
                {
                    status: 'resolved',
                    resolvedBy,
                    resolvedAt: new Date(),
                    resolutionData: resolutionResults
                }
            );

            return resolutionResults;
        });
    }

    /**
     * Identify which actions clash with each other
     * @param {Array} actions - Array of combat actions
     * @returns {Object} Object with clashes and independent actions
     */
    identifyClashes(actions) {
        const clashes = [];
        const independentActions = [];
        const processedActions = new Set();

        for (let i = 0; i < actions.length; i++) {
            if (processedActions.has(actions[i].id)) continue;

            const action1 = actions[i];
            let clashFound = false;

            // Look for clashing actions
            for (let j = i + 1; j < actions.length; j++) {
                if (processedActions.has(actions[j].id)) continue;

                const action2 = actions[j];

                // Check if these actions clash
                if (this.actionsClash(action1, action2)) {
                    clashes.push([action1, action2]);
                    processedActions.add(action1.id);
                    processedActions.add(action2.id);
                    clashFound = true;
                    break;
                }
            }

            if (!clashFound) {
                independentActions.push(action1);
                processedActions.add(action1.id);
            }
        }

        return { clashes, independentActions };
    }

    /**
     * Determine if two actions clash
     * @param {Object} action1 - First combat action
     * @param {Object} action2 - Second combat action
     * @returns {boolean} True if actions clash
     */
    actionsClash(action1, action2) {
        // Actions clash if they target each other
        const action1TargetsAction2 = action1.targetId === action2.characterId;
        const action2TargetsAction1 = action2.targetId === action1.characterId;

        // Basic clash conditions
        if (action1TargetsAction2 && action2TargetsAction1) {
            return true; // Mutual targeting
        }

        // Additional clash logic based on skill types
        const type1 = action1.skillData.type?.toLowerCase() || '';
        const type2 = action2.skillData.type?.toLowerCase() || '';

        // Attacks vs defenses when targeting each other
        if (action1TargetsAction2 && 
            (type1.includes('attack') || type1.includes('offensive')) &&
            (type2.includes('defence') || type2.includes('defensive'))) {
            return true;
        }

        if (action2TargetsAction1 && 
            (type2.includes('attack') || type2.includes('offensive')) &&
            (type1.includes('defence') || type1.includes('defensive'))) {
            return true;
        }

        return false;
    }

    /**
     * Resolve a clash between two actions
     * @param {Array} clashActions - Array of two clashing actions
     * @param {Object} manager - Transaction manager
     * @returns {Promise<Object>} Clash resolution result
     */
    async resolveClash(clashActions, manager) {
        const [action1, action2] = clashActions;
        
        // Use PvPResolutionService to resolve the clash
        const character1 = action1.character;
        const character2 = action2.character;
        const skill1 = action1.skill;
        const skill2 = action2.skill;

        // Create temporary skill engines for clash resolution
        const engine1 = new SkillEngine(character1, skill1);
        const engine2 = new SkillEngine(character2, skill2);

        // Use the existing clash resolution
        const clashResult = await engine1.resolveClash(character2, skill2);

        const result = {
            isClash: true,
            participants: [
                {
                    character: action1.characterData.name,
                    skill: action1.skillData.name,
                    skillType: action1.skillData.type,
                    target: action1.targetData?.name || 'Self',
                    finalOutput: action1.finalOutput,
                    rollQuality: action1.rollQuality
                },
                {
                    character: action2.characterData.name,
                    skill: action2.skillData.name,
                    skillType: action2.skillData.type,
                    target: action2.targetData?.name || 'Self',
                    finalOutput: action2.finalOutput,
                    rollQuality: action2.rollQuality
                }
            ],
            winner: clashResult.winner,
            damage: clashResult.damage,
            effects: clashResult.effects,
            details: `${action1.characterData.name} (${action1.skillData.name}: ${action1.finalOutput}) vs ${action2.characterData.name} (${action2.skillData.name}: ${action2.finalOutput})`
        };

        // Store clash result in both actions
        const actionRepo = manager.getRepository(CombatAction);
        await actionRepo.update(action1.id, { clashResult: result });
        await actionRepo.update(action2.id, { clashResult: result });

        return result;
    }

    /**
     * Process an independent (non-clashing) action
     * @param {Object} action - Combat action
     * @returns {Object} Independent action result
     */
    processIndependentAction(action) {
        return {
            isClash: false,
            character: action.characterData.name,
            skill: action.skillData.name,
            skillType: action.skillData.type,
            target: action.targetData?.name || (action.skillData.target === 'self' ? 'Self' : 'Area'),
            finalOutput: action.finalOutput,
            rollQuality: action.rollQuality,
            details: `${action.characterData.name} used ${action.skillData.name} on ${action.targetData?.name || action.skillData.target} (Output: ${action.finalOutput})`
        };
    }

    /**
     * Get resolved rounds for a location
     * @param {number} locationId - The location ID
     * @param {number} limit - Maximum number of rounds to return
     * @returns {Promise<Array>} Array of resolved rounds
     */
    async getResolvedRounds(locationId, limit = 10) {
        return await this.roundRepository.find({
            where: { locationId, status: 'resolved' },
            order: { resolvedAt: 'DESC' },
            take: limit
        });
    }

    /**
     * Cancel an active round
     * @param {number} roundId - The combat round ID
     * @param {number} cancelledBy - User ID cancelling the round
     * @returns {Promise<Object>} Updated round
     */
    async cancelRound(roundId, cancelledBy) {
        await this.roundRepository.update(
            { id: roundId, status: 'active' },
            {
                status: 'cancelled',
                resolvedBy: cancelledBy,
                resolvedAt: new Date()
            }
        );

        return await this.roundRepository.findOne({ where: { id: roundId } });
    }
} 