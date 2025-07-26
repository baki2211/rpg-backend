import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { SkillEngine } from './SkillEngine.js';
import { PvPResolutionService } from './PvPResolutionService.js';
import { SkillUsageService } from './SkillUsageService.js';
import { EngineLogService } from './EngineLogService.js';

export class CombatService {
    constructor() {
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.actionRepository = AppDataSource.getRepository(CombatAction);
        this.characterRepository = AppDataSource.getRepository(Character);
        this.skillRepository = AppDataSource.getRepository(Skill);
        this.engineLogService = new EngineLogService();
    }

    /**
     * Optimized target resolution that tries multiple lookup strategies in a single query
     * @param {string|number} targetId - Target identifier (could be ID, userID, or name)
     * @returns {Promise<Object|null>} Found character or null
     */
    async findTargetCharacter(targetId) {
        if (!targetId) return null;
        
        // Batch all possible lookups in a single query using OR conditions
        const target = await this.characterRepository.findOne({
            where: [
                { id: targetId, isActive: true },                    // Character ID lookup
                { userId: targetId, isActive: true },                // User ID lookup  
                { name: targetId, isActive: true }                   // Name lookup
            ],
            relations: ['race', 'skills'] // Eager load commonly needed relations
        });
        
        return target;
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
        // Ensure there's always an active session for engine logging
        if (!sessionId) {
            const { SessionService } = await import('./SessionService.js');
            const sessionService = new SessionService();
            
            let activeSession = await sessionService.getActiveSessionByLocation(locationId);
            
            if (!activeSession) {
                // Create a session for this location if none exists
                activeSession = await sessionService.createSession(
                    `Auto-created for Location ${locationId}`,
                    locationId
                );
            }
            
            sessionId = activeSession.id;
        }

        // Get the next round number for this location/event context
        let roundNumber = 1;
        
        if (eventId) {
            // For event rounds, get the last round for this specific event
            const lastEventRound = await this.roundRepository.findOne({
                where: { eventId },
                order: { roundNumber: 'DESC' }
            });
            roundNumber = lastEventRound ? lastEventRound.roundNumber + 1 : 1;
        } else {
            // For non-event rounds, get the last round for this location (excluding event rounds)
            const lastLocationRound = await this.roundRepository.findOne({
                where: { locationId, eventId: null },
                order: { roundNumber: 'DESC' }
            });
            roundNumber = lastLocationRound ? lastLocationRound.roundNumber + 1 : 1;
        }

        const round = this.roundRepository.create({
            roundNumber,
            locationId,
            sessionId,
            eventId,
            createdBy,
            status: 'active'
        });

        const savedRound = await this.roundRepository.save(round);
        return savedRound;
    }

    /**
     * Submit a skill action to an active round
     * @param {number} roundId - The combat round ID
     * @param {number} characterId - The character performing the action
     * @param {number} skillId - The skill being used
     * @param {number} targetId - The target character (null for self/area skills)
     * @param {Object|null} preCalculatedValues - Pre-calculated skill values from ChatService
     * @returns {Promise<Object>} The created combat action
     */
    async submitAction(roundId, characterId, skillId, targetId = null, preCalculatedValues = null) {
        // Verify round exists and is active
        const round = await this.roundRepository.findOne({
            where: { id: roundId, status: 'active' }
        });

        if (!round) {
            throw new Error('Combat round not found or not active');
        }

        // Check if character already has an action in this round FIRST (before doing expensive operations)
        const existingAction = await this.actionRepository.findOne({
            where: { roundId, characterId }
        });

        if (existingAction) {
            throw new Error('Character has already submitted an action for this round');
        }
        // Get character and skill data
        const [character, skill] = await Promise.all([
            this.characterRepository.findOne({
                where: { id: characterId },
                relations: ['race']
            }),
            (async () => {
                const { default: staticDataCache } = await import('../utils/staticDataCache.js');
                return staticDataCache.getSkillById(skillId, true);
            })()
        ]);

        if (!character) throw new Error('Character not found');
        if (!skill) throw new Error('Skill not found');

        // Handle target validation based on skill requirements
        let target = null;
        let finalTargetId = null;

        if (skill.target === 'self') {
            // Self-targeting skills should target the character using the skill
            finalTargetId = characterId;
            target = character;
        } else if (skill.target === 'other') {
            // Other-targeting skills require a valid target
            if (!targetId || targetId === characterId) {
                throw new Error('This skill requires a target other than yourself');
            }
            
            target = await this.findTargetCharacter(targetId);
            if (!target) {
                // Get available characters for better error message
                const availableCharacters = await this.characterRepository.find({
                    select: ['id', 'name', 'surname', 'isActive', 'userId'],
                    where: { isActive: true }
                });
                const characterList = availableCharacters.map(c => `${c.name} ${c.surname || ''} (CharID: ${c.id}, UserID: ${c.userId})`).join(', ');
                throw new Error(`Target character not found. Searched for ID/name: ${targetId}. Available characters: ${characterList}`);
            }
            finalTargetId = target.id;
        } else if (skill.target === 'any') {
            // Skills that can target self or others
            if (!targetId) {
                // Default to self if no target specified
                finalTargetId = characterId;
                target = character;
            } else if (targetId === characterId) {
                // Self-targeting
                finalTargetId = characterId;
                target = character;
            } else {
                // Other-targeting
                target = await this.findTargetCharacter(targetId);
                if (!target) {
                    // Get available characters for better error message
                    const availableCharacters = await this.characterRepository.find({
                        select: ['id', 'name', 'surname', 'isActive', 'userId'],
                        where: { isActive: true }
                    });
                    const characterList = availableCharacters.map(c => `${c.name} ${c.surname || ''} (CharID: ${c.id}, UserID: ${c.userId})`).join(', ');
                    throw new Error(`Target character not found. Searched for ID/name: ${targetId}. Available characters: ${characterList}`);
                }
                finalTargetId = target.id;
            }
        } else if (skill.target === 'none') {
            // Area/no-target skills don't need a target
            finalTargetId = null;
            target = null;
        } else {
            // Handle any other target types or default behavior
            if (targetId) {
                target = await this.findTargetCharacter(targetId);
                if (!target) {
                    // Get available characters for better error message
                    const availableCharacters = await this.characterRepository.find({
                        select: ['id', 'name', 'surname', 'isActive', 'userId'],
                        where: { isActive: true }
                    });
                    const characterList = availableCharacters.map(c => `${c.name} ${c.surname || ''} (CharID: ${c.id}, UserID: ${c.userId})`).join(', ');
                    throw new Error(`Target character not found. Searched for ID/name: ${targetId}. Available characters: ${characterList}`);
                }
                finalTargetId = target.id;
            } else {
                // Default to self for unknown target types
                finalTargetId = characterId;
                target = character;
            }
        }

        // Use pre-calculated values if provided, otherwise calculate using SkillEngine
        let finalOutput, outcomeMultiplier, rollQuality;
        
        if (preCalculatedValues) {
          // Use pre-calculated values from ChatService
          finalOutput = preCalculatedValues.finalOutput;
          rollQuality = preCalculatedValues.rollQuality;
          
          // Calculate approximate outcomeMultiplier based on roll quality
          if (rollQuality === 'Critical') {
            outcomeMultiplier = 1.4;
          } else if (rollQuality === 'Poor') {
            outcomeMultiplier = 0.6;
          } else {
            outcomeMultiplier = 1.0;
          }
        } else {
          // Fall back to calculating new values or looking for recent chat message
          try {
            const { ChatMessage } = await import('../models/chatMessageModel.js');
            const chatRepository = AppDataSource.getRepository(ChatMessage);
            const { MoreThanOrEqual, Not, IsNull } = await import('typeorm');
            
            // Look for recent chat message (within last 5 minutes) with this skill
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const recentSkillMessage = await chatRepository.findOne({
              where: {
                characterId: character.id,
                skillId: skill.id,
                skillOutput: Not(IsNull()),
                createdAt: MoreThanOrEqual(fiveMinutesAgo)
              },
              order: { createdAt: 'DESC' }
            });

            // Also try to find ANY recent message with this skill (in case timing is off)
            if (!recentSkillMessage) {
              const recentMessages = await chatRepository.find({
                where: {
                  characterId: character.id,
                  skillId: skill.id,
                  skillOutput: Not(IsNull())
                },
                order: { createdAt: 'DESC' },
                take: 10
              });
            }

            if (recentSkillMessage && recentSkillMessage.skillOutput && recentSkillMessage.skillRoll) {
              // Use pre-calculated values from chat
              finalOutput = recentSkillMessage.skillOutput;
              
              // Parse roll quality from skillRoll (e.g., "Critical Success" -> "Critical")
              if (recentSkillMessage.skillRoll.includes('Critical')) {
                rollQuality = 'Critical';
                outcomeMultiplier = 1.4;
              } else if (recentSkillMessage.skillRoll.includes('Poor')) {
                rollQuality = 'Poor';
                outcomeMultiplier = 0.6;
              } else {
                rollQuality = 'Standard';
                outcomeMultiplier = 1.0;
              }
            } else {
              throw new Error('No recent chat values found');
            }
          } catch (error) {
            // Calculate new values using SkillEngine
            const skillEngine = new SkillEngine(character, skill);
            finalOutput = await skillEngine.computeFinalOutput();
            outcomeMultiplier = skillEngine.rollOutcome();

            // Determine roll quality
            rollQuality = 'Standard';
            if (outcomeMultiplier <= 0.6) rollQuality = 'Poor';
            else if (outcomeMultiplier >= 1.4) rollQuality = 'Critical';
          }
        }

        // Create the combat action
        const action = this.actionRepository.create({
            roundId,
            characterId,
            skillId,
            targetId: finalTargetId,
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
     * @param {number} eventId - Optional event ID to filter by
     * @returns {Promise<Object|null>} The active round or null
     */
    async getActiveRound(locationId, eventId = null) {
        const whereCondition = { locationId, status: 'active' };
        
        if (eventId !== null) {
            whereCondition.eventId = eventId;
        }
        
        return await this.roundRepository.findOne({
            where: whereCondition,
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
        try {
            return await AppDataSource.transaction(async (manager) => {
                const roundRepo = manager.getRepository(CombatRound);
                const actionRepo = manager.getRepository(CombatAction);

                // First, lock the round without relations
                const roundLock = await roundRepo.findOne({
                    where: { id: roundId, status: 'active' },
                    lock: { mode: 'pessimistic_write' } // Exclusive lock during resolution
                });

                if (!roundLock) {
                    throw new Error('Combat round not found or not active');
                }

                // Then get the round with relations (now that we have the lock)
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
                for (let i = 0; i < clashes.length; i++) {
                    try {
                        const clashResult = await this.resolveClash(clashes[i], manager);
                        resolutionResults.clashes.push(clashResult);
                    } catch (clashError) {
                        throw new Error(`Failed to resolve clash ${i + 1}: ${clashError.message}`);
                    }
                }

                // Process independent actions
                for (let i = 0; i < independentActions.length; i++) {
                    try {
                        const independentResult = this.processIndependentAction(independentActions[i]);
                        resolutionResults.independentActions.push(independentResult);
                    } catch (independentError) {
                        throw new Error(`Failed to process independent action ${i + 1}: ${independentError.message}`);
                    }
                }

                // Batch round and action updates for better performance
                await Promise.all([
                    // Mark actions as processed
                    actionRepo.update(
                        { roundId },
                        { processed: true }
                    ),
                    // Update round status (pessimistic lock already acquired above)
                    roundRepo.update(
                        { id: roundId },
                        {
                            status: 'resolved',
                            resolvedBy,
                            resolvedAt: new Date(),
                            resolutionData: resolutionResults
                        }
                    )
                ]);

                return resolutionResults;
            }).then(async (results) => {
                // Create engine logs after successful transaction
                try {
                    const round = await this.roundRepository.findOne({ 
                        where: { id: roundId },
                        relations: ['actions']
                    });

                    if (round) {
                        // Create comprehensive round resolution log
                        await this.logRoundResolution(round.locationId, round.roundNumber, results);
                    }
                } catch (logError) {
                    // Don't fail the entire operation if logging fails
                }

                return results;
            });
        } catch (mainError) {
            logger.error(`Combat round resolution failed`, { 
                roundId, 
                error: mainError.message, 
                stack: mainError.stack 
            });
            throw mainError; // Re-throw to let the controller handle the response
        }
    }

    /**
     * Identify which actions clash with each other using optimized O(n) algorithm
     * @param {Array} actions - Array of combat actions
     * @returns {Object} Object with clashes and independent actions
     */
    identifyClashes(actions) {
        const clashes = [];
        const independentActions = [];
        const processedActions = new Set();

        // Create indexed lookups for efficient clash detection - O(n) preprocessing
        const actionsByCharacter = new Map(); // character -> actions by that character
        const actionsByTarget = new Map();    // target -> actions targeting that character
        const actionsByType = new Map();      // skill type -> actions of that type

        // Build indexes - O(n)
        actions.forEach(action => {
            // Index by character
            if (!actionsByCharacter.has(action.characterId)) {
                actionsByCharacter.set(action.characterId, []);
            }
            actionsByCharacter.get(action.characterId).push(action);

            // Index by target (if exists)
            if (action.targetId) {
                if (!actionsByTarget.has(action.targetId)) {
                    actionsByTarget.set(action.targetId, []);
                }
                actionsByTarget.get(action.targetId).push(action);
            }

            // Index by skill type category
            const skillType = PvPResolutionService.getSkillTypeCategory(action.skillData.type);
            if (!actionsByType.has(skillType)) {
                actionsByType.set(skillType, []);
            }
            actionsByType.get(skillType).push(action);
        });

        // Find clashes using indexed lookups - O(n) average case
        actions.forEach(action1 => {
            if (processedActions.has(action1.id)) return;

            let clashFound = false;
            const potentialClashActions = new Set();

            // Get potential clash candidates based on different criteria
            // 1. Actions targeting this character
            const actionsTargetingChar = actionsByTarget.get(action1.characterId) || [];
            actionsTargetingChar.forEach(a => potentialClashActions.add(a));

            // 2. Actions targeted by this character
            if (action1.targetId) {
                const actionsFromTarget = actionsByCharacter.get(action1.targetId) || [];
                actionsFromTarget.forEach(a => potentialClashActions.add(a));
            }

            // 3. For attack actions, check for defenses protecting the target
            const action1Type = PvPResolutionService.getSkillTypeCategory(action1.skillData.type);
            if (action1Type === 'Attack' && action1.targetId) {
                const defenseActions = actionsByType.get('Defence') || [];
                defenseActions.forEach(defense => {
                    if (defense.targetId === action1.targetId) {
                        potentialClashActions.add(defense);
                    }
                });
            }

            // Check only potential candidates instead of all actions
            for (const action2 of potentialClashActions) {
                if (processedActions.has(action2.id) || action1.id === action2.id) continue;

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
        });

        return { clashes, independentActions };
    }

    /**
     * Determine if two actions clash
     * @param {Object} action1 - First combat action
     * @param {Object} action2 - Second combat action
     * @returns {boolean} True if actions clash
     */
    actionsClash(action1, action2) {
        // Get skill type categories using PvPResolutionService
        const type1 = PvPResolutionService.getSkillTypeCategory(action1.skillData.type);
        const type2 = PvPResolutionService.getSkillTypeCategory(action2.skillData.type);
        
        // Actions clash if they target each other
        const action1TargetsAction2 = action1.targetId === action2.characterId;
        const action2TargetsAction1 = action2.targetId === action1.characterId;
        const targetsEachOther = action1TargetsAction2 && action2TargetsAction1;
        
        // Check for clashes based on the comprehensive clash table
        
        // Attack vs Attack - Always clash if targeting each other
        if (type1 === 'Attack' && type2 === 'Attack' && targetsEachOther) {
            return true;
        }

        // Attack vs Defence - Clash if:
        // 1. They target each other (attacker vs defender)
        // 2. Attack targets the same person the defence is protecting
        // 3. Defence is protecting the attacker (intercepting their own attack)
        if ((type1 === 'Attack' && type2 === 'Defence') || 
            (type1 === 'Defence' && type2 === 'Attack')) {
            
            // Get the actual attack and defence actions
            const attackAction = type1 === 'Attack' ? action1 : action2;
            const defenceAction = type1 === 'Defence' ? action1 : action2;
            
            // Clash conditions:
            // 1. Attack targets the person being defended (most common case)
            const attackTargetsDefended = attackAction.targetId === defenceAction.targetId;
            
            // 2. Defence targets the attacker (protecting them from their own attack - rare but possible)
            const defenceTargetsAttacker = defenceAction.targetId === attackAction.characterId;
            
            // 3. Special case: Attack targets the defender who is using self-defense
            const attackTargetsDefender = attackAction.targetId === defenceAction.characterId;
            
            // 4. Special case: Self-defense against attack on same target
            const isSelfDefense = defenceAction.targetId === defenceAction.characterId;
            const attacksDefensiveTarget = attackAction.targetId === defenceAction.characterId;
            
            if (targetsEachOther || attackTargetsDefended || defenceTargetsAttacker || 
                attackTargetsDefender || (isSelfDefense && attacksDefensiveTarget)) {
                return true;
            }
        }

        // Attack vs Counter - Always clash (counter can respond to any attack)
        if ((type1 === 'Attack' && type2 === 'Counter') || 
            (type1 === 'Counter' && type2 === 'Attack')) {
            return true;
        }

        // Attack vs Buff/Heal - Conditional clash (always considered a clash for processing)
        if ((type1 === 'Attack' && (type2 === 'Buff' || type2 === 'Heal')) ||
            ((type1 === 'Buff' || type1 === 'Heal') && type2 === 'Attack')) {
            return true; // Conditional clashes are still processed as clashes
        }

        // Attack vs Debuff - Conditional clash (always considered a clash for processing)
        if ((type1 === 'Attack' && type2 === 'Debuff') ||
            (type1 === 'Debuff' && type2 === 'Attack')) {
            return true; // Conditional clashes are still processed as clashes
        }

        // Attack vs Crafting - Edge case clash
        if ((type1 === 'Attack' && type2 === 'Crafting') ||
            (type1 === 'Crafting' && type2 === 'Attack')) {
            return true;
        }

        // All other combinations don't clash
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
        
        // Use PvPResolutionService to resolve the clash with comprehensive logic
        const character1 = action1.character;
        const character2 = action2.character;
        const skill1 = action1.skill;
        const skill2 = action2.skill;

        // Use PvPResolutionService for comprehensive clash resolution
        // Use the pre-calculated outputs from the actions instead of recalculating
        // Create skill objects from the stored skillData to ensure we have all the necessary information
        const skillObj1 = {
            id: action1.skillData.id,
            name: action1.skillData.name,
            type: { name: action1.skillData.type },
            target: action1.skillData.target
        };
        
        const skillObj2 = {
            id: action2.skillData.id,
            name: action2.skillData.name,
            type: { name: action2.skillData.type },
            target: action2.skillData.target
        };
        
        const clashResult = PvPResolutionService.determineClash(
            skillObj1, skillObj2, action1.finalOutput, action2.finalOutput
        );

        const result = {
            isClash: clashResult.isClash,
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
            resolution: clashResult.resolution,
            details: clashResult.resolution || `${action1.characterData.name} (${action1.skillData.name}: ${action1.finalOutput}) vs ${action2.characterData.name} (${action2.skillData.name}: ${action2.finalOutput})`
        };

        // Store clash result in both actions (batched for performance)
        const actionRepo = manager.getRepository(CombatAction);
        await Promise.all([
            actionRepo.update(action1.id, { clashResult: result }),
            actionRepo.update(action2.id, { clashResult: result })
        ]);

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
     * @param {number} eventId - Optional event ID to filter by
     * @returns {Promise<Array>} Array of resolved rounds
     */
    async getResolvedRounds(locationId, limit = 10, eventId = null) {
        const whereCondition = { locationId, status: 'resolved' };
        
        if (eventId !== null) {
            whereCondition.eventId = eventId;
        }
        
        return await this.roundRepository.find({
            where: whereCondition,
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

    /**
     * Log a clash result to the engine logs
     * @param {number} locationId - The location ID
     * @param {Object} clashResult - The clash result to log
     */
    async logClashResult(locationId, clashResult) {
        const participant1 = clashResult.participants[0];
        const participant2 = clashResult.participants[1];
        
        let details;
        let effects = ['Clash Resolution'];
        
        // Use the resolution text if available, otherwise fall back to old format
        if (clashResult.resolution) {
            details = `CLASH: ${participant1.character} (${participant1.skill}: ${participant1.finalOutput}) vs ${participant2.character} (${participant2.skill}: ${participant2.finalOutput}) - ${clashResult.resolution}`;
            
            // Add effects from the clash result
            if (clashResult.effects && Array.isArray(clashResult.effects)) {
                effects.push(...clashResult.effects);
            }
            
            // Add damage information if present
            if (clashResult.damage) {
                if (typeof clashResult.damage === 'object') {
                    if (clashResult.damage.attacker > 0) {
                        effects.push(`${participant1.character} takes ${clashResult.damage.attacker} damage`);
                    }
                    if (clashResult.damage.defender > 0) {
                        effects.push(`${participant2.character} takes ${clashResult.damage.defender} damage`);
                    }
                } else {
                    effects.push(`Damage: ${clashResult.damage}`);
                }
            }
        } else {
            // Fallback to old format
            if (clashResult.winner === 'attacker') {
                details = `CLASH: ${participant1.character} (${participant1.skill}: ${participant1.finalOutput}) defeated ${participant2.character} (${participant2.skill}: ${participant2.finalOutput}). Damage: ${clashResult.damage}`;
                effects.push(`Winner: ${participant1.character}`, `Damage: ${clashResult.damage}`);
            } else if (clashResult.winner === 'defender') {
                details = `CLASH: ${participant2.character} (${participant2.skill}: ${participant2.finalOutput}) defeated ${participant1.character} (${participant1.skill}: ${participant1.finalOutput}). Damage: ${clashResult.damage}`;
                effects.push(`Winner: ${participant2.character}`, `Damage: ${clashResult.damage}`);
            } else {
                details = `CLASH: ${participant1.character} (${participant1.skill}: ${participant1.finalOutput}) vs ${participant2.character} (${participant2.skill}: ${participant2.finalOutput}) - TIE! Both take ${clashResult.damage} damage`;
                effects.push('Result: Tie', `Both take ${clashResult.damage} damage`);
            }
        }

        // Add roll qualities to effects
        effects.push(`${participant1.character}: ${participant1.rollQuality} roll`);
        effects.push(`${participant2.character}: ${participant2.rollQuality} roll`);

        await this.engineLogService.createEngineLog(
            locationId,
            'clash',
            participant1.character,
            participant2.character,
            `${participant1.skill} vs ${participant2.skill}`,
            clashResult.damage,
            effects,
            details,
            clashResult
        );
    }

    /**
     * Log an independent action to the engine logs
     * @param {number} locationId - The location ID
     * @param {Object} actionResult - The independent action result to log
     */
    async logIndependentAction(locationId, actionResult) {
        const effects = [
            `Output: ${actionResult.finalOutput}`,
            `Roll: ${actionResult.rollQuality}`,
            `Type: ${actionResult.skillType}`
        ];

        await this.engineLogService.createEngineLog(
            locationId,
            'skill_use',
            actionResult.character,
            actionResult.target !== 'Self' && actionResult.target !== 'Area' ? actionResult.target : null,
            actionResult.skill,
            null,
            effects,
            actionResult.details,
            {
                finalOutput: actionResult.finalOutput,
                rollQuality: actionResult.rollQuality,
                skillType: actionResult.skillType,
                target: actionResult.target
            }
        );
    }

    /**
     * Log comprehensive round resolution with all details
     * @param {number} locationId - The location ID
     * @param {number} roundNumber - The round number
     * @param {Object} results - The complete resolution results
     */
    async logRoundResolution(locationId, roundNumber, results) {
        // Build comprehensive round summary
        const roundSummary = {
            roundNumber,
            totalActions: results.summary.totalActions,
            clashCount: results.summary.clashCount,
            independentCount: results.summary.independentCount,
            actionBreakdown: [],
            clashDetails: [],
            independentDetails: []
        };

        // Process clash details
        for (const clash of results.clashes) {
            const clashDetail = {
                isClash: true,
                participants: clash.participants.map(p => ({
                    actor: p.character,
                    target: p.target,
                    skill: p.skill,
                    skillType: p.skillType,
                    finalOutput: p.finalOutput,
                    rollQuality: p.rollQuality
                })),
                winner: clash.winner,
                resolution: clash.resolution,
                damage: clash.damage,
                effects: clash.effects
            };
            roundSummary.clashDetails.push(clashDetail);
            
            // Add to action breakdown
            roundSummary.actionBreakdown.push({
                type: 'clash',
                actors: clash.participants.map(p => p.character),
                skills: clash.participants.map(p => p.skill),
                result: clash.resolution
            });
        }

        // Process independent action details
        for (const independent of results.independentActions) {
            const independentDetail = {
                isClash: false,
                actor: independent.character,
                target: independent.target,
                skill: independent.skill,
                skillType: independent.skillType,
                finalOutput: independent.finalOutput,
                rollQuality: independent.rollQuality,
                details: independent.details
            };
            roundSummary.independentDetails.push(independentDetail);
            
            // Add to action breakdown
            roundSummary.actionBreakdown.push({
                type: 'independent',
                actor: independent.character,
                skill: independent.skill,
                target: independent.target,
                output: independent.finalOutput
            });
        }

        // Create the main round resolution log
        const effects = [
            `Round ${roundNumber} Complete`,
            `${results.summary.totalActions} total actions`,
            `${results.summary.clashCount} clashes`,
            `${results.summary.independentCount} independent actions`
        ];

        // Build simple text description for the log
        let description = `=== ROUND ${roundNumber} RESOLUTION ===\n\n`;
        
        // Add action submissions
        description += `SUBMITTED ACTIONS:\n`;
        for (const action of roundSummary.actionBreakdown) {
            if (action.type === 'clash') {
                description += `• ${action.actors[0]} uses ${action.skills[0]} vs ${action.actors[1]} uses ${action.skills[1]}\n`;
            } else {
                description += `• ${action.actor} uses ${action.skill} on ${action.target}\n`;
            }
        }
        description += `\n`;

        // Add clash resolutions
        if (roundSummary.clashDetails.length > 0) {
            description += `CLASH RESOLUTIONS:\n`;
            for (let i = 0; i < roundSummary.clashDetails.length; i++) {
                const clash = roundSummary.clashDetails[i];
                description += `Clash ${i + 1}: ${clash.participants[0].actor} (${clash.participants[0].skill}: ${clash.participants[0].finalOutput}) vs ${clash.participants[1].actor} (${clash.participants[1].skill}: ${clash.participants[1].finalOutput})\n`;
                description += `  → ${clash.resolution}\n`;
                if (clash.winner) {
                    description += `  → Winner: ${clash.winner}\n`;
                }
                if (clash.damage && typeof clash.damage === 'object') {
                    if (clash.damage.attacker > 0) description += `  → ${clash.participants[0].actor} takes ${clash.damage.attacker} damage\n`;
                    if (clash.damage.defender > 0) description += `  → ${clash.participants[1].actor} takes ${clash.damage.defender} damage\n`;
                }
                description += `\n`;
            }
        }

        // Add independent actions
        if (roundSummary.independentDetails.length > 0) {
            description += `INDEPENDENT ACTIONS:\n`;
            for (const independent of roundSummary.independentDetails) {
                description += `• ${independent.actor} uses ${independent.skill} on ${independent.target} (Output: ${independent.finalOutput}, Roll: ${independent.rollQuality})\n`;
            }
            description += `\n`;
        }

        description += `ROUND ${roundNumber} COMPLETE`;

        await this.engineLogService.createEngineLog(
            locationId,
            'effect',
            'System',
            null,
            null,
            null,
            effects,
            description,
            roundSummary
        );
    }
} 