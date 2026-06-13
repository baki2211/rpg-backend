import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { PvPResolutionService } from './PvPResolutionService.js';
import { EngineLogService } from './EngineLogService.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';

export class CombatResolutionService {
    constructor() {
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.actionRepository = AppDataSource.getRepository(CombatAction);
        this.engineLogService = new EngineLogService();
    }

    /**
     * Resolve a combat round
     * @param {number} roundId - The combat round ID
     * @param {number} resolvedBy - User ID of the master resolving the round
     * @returns {Promise<Object>} Resolution result
     */
    async resolveRound(roundId, resolvedBy) {
        const results = await AppDataSource.transaction(async (manager) => {
            const roundRepo = manager.getRepository(CombatRound);
            const actionRepo = manager.getRepository(CombatAction);

            const roundLock = await roundRepo.findOne({
                where: { id: roundId, status: 'active' },
                lock: { mode: 'pessimistic_write' }
            });

            if (!roundLock) {
                throw new HttpError(404, 'Combat round not found or not active');
            }

            const round = await roundRepo.findOne({
                where: { id: roundId, status: 'active' },
                relations: ['actions', 'actions.character', 'actions.skill', 'actions.target']
            });

            if (!round) {
                throw new HttpError(404, 'Combat round not found or not active');
            }

            const actions = round.actions || [];
            if (actions.length === 0) {
                throw new HttpError(400, 'No actions to resolve');
            }

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

            for (const clash of clashes) {
                resolutionResults.clashes.push(await this.resolveClash(clash, manager));
            }

            for (const independent of independentActions) {
                resolutionResults.independentActions.push(this.processIndependentAction(independent));
            }

            await Promise.all([
                actionRepo.update(
                    { roundId },
                    { processed: true }
                ),
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
        });

        try {
            const round = await this.roundRepository.findOne({
                where: { id: roundId },
                relations: ['actions']
            });

            if (round) {
                await this.logRoundResolution(round.locationId, round.roundNumber, results);
            }
        } catch (logError) {
            logger.error('Failed to log combat round resolution', {
                roundId,
                error: logError.message,
                stack: logError.stack
            });
        }

        return results;
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

        const actionsByCharacter = new Map();
        const actionsByTarget = new Map();
        const actionsByType = new Map();

        actions.forEach(action => {
            if (!actionsByCharacter.has(action.characterId)) {
                actionsByCharacter.set(action.characterId, []);
            }
            actionsByCharacter.get(action.characterId).push(action);

            if (action.targetId) {
                if (!actionsByTarget.has(action.targetId)) {
                    actionsByTarget.set(action.targetId, []);
                }
                actionsByTarget.get(action.targetId).push(action);
            }

            const skillType = PvPResolutionService.getSkillTypeCategory(action.skillData.type);
            if (!actionsByType.has(skillType)) {
                actionsByType.set(skillType, []);
            }
            actionsByType.get(skillType).push(action);
        });

        actions.forEach(action1 => {
            if (processedActions.has(action1.id)) return;

            let clashFound = false;
            const potentialClashActions = new Set();

            const actionsTargetingChar = actionsByTarget.get(action1.characterId) || [];
            actionsTargetingChar.forEach(a => potentialClashActions.add(a));

            if (action1.targetId) {
                const actionsFromTarget = actionsByCharacter.get(action1.targetId) || [];
                actionsFromTarget.forEach(a => potentialClashActions.add(a));
            }

            const action1Type = PvPResolutionService.getSkillTypeCategory(action1.skillData.type);
            if (action1Type === 'Attack' && action1.targetId) {
                const defenseActions = actionsByType.get('Defence') || [];
                defenseActions.forEach(defense => {
                    if (defense.targetId === action1.targetId) {
                        potentialClashActions.add(defense);
                    }
                });
            }

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
        const type1 = PvPResolutionService.getSkillTypeCategory(action1.skillData.type);
        const type2 = PvPResolutionService.getSkillTypeCategory(action2.skillData.type);

        const action1TargetsAction2 = action1.targetId === action2.characterId;
        const action2TargetsAction1 = action2.targetId === action1.characterId;
        const targetsEachOther = action1TargetsAction2 && action2TargetsAction1;

        if (type1 === 'Attack' && type2 === 'Attack' && targetsEachOther) {
            return true;
        }

        if ((type1 === 'Attack' && type2 === 'Defence') ||
            (type1 === 'Defence' && type2 === 'Attack')) {

            const attackAction = type1 === 'Attack' ? action1 : action2;
            const defenceAction = type1 === 'Defence' ? action1 : action2;

            const attackTargetsDefended = attackAction.targetId === defenceAction.targetId;
            const defenceTargetsAttacker = defenceAction.targetId === attackAction.characterId;
            const attackTargetsDefender = attackAction.targetId === defenceAction.characterId;
            const isSelfDefense = defenceAction.targetId === defenceAction.characterId;
            const attacksDefensiveTarget = attackAction.targetId === defenceAction.characterId;

            if (targetsEachOther || attackTargetsDefended || defenceTargetsAttacker ||
                attackTargetsDefender || (isSelfDefense && attacksDefensiveTarget)) {
                return true;
            }
        }

        if ((type1 === 'Attack' && type2 === 'Counter') ||
            (type1 === 'Counter' && type2 === 'Attack')) {
            return true;
        }

        if ((type1 === 'Attack' && (type2 === 'Buff' || type2 === 'Heal')) ||
            ((type1 === 'Buff' || type1 === 'Heal') && type2 === 'Attack')) {
            return true;
        }

        if ((type1 === 'Attack' && type2 === 'Debuff') ||
            (type1 === 'Debuff' && type2 === 'Attack')) {
            return true;
        }

        if ((type1 === 'Attack' && type2 === 'Crafting') ||
            (type1 === 'Crafting' && type2 === 'Attack')) {
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
     * Log comprehensive round resolution with all details
     * @param {number} locationId - The location ID
     * @param {number} roundNumber - The round number
     * @param {Object} results - The complete resolution results
     */
    async logRoundResolution(locationId, roundNumber, results) {
        const roundSummary = {
            roundNumber,
            totalActions: results.summary.totalActions,
            clashCount: results.summary.clashCount,
            independentCount: results.summary.independentCount,
            actionBreakdown: [],
            clashDetails: [],
            independentDetails: []
        };

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

            roundSummary.actionBreakdown.push({
                type: 'clash',
                actors: clash.participants.map(p => p.character),
                skills: clash.participants.map(p => p.skill),
                result: clash.resolution
            });
        }

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

            roundSummary.actionBreakdown.push({
                type: 'independent',
                actor: independent.character,
                skill: independent.skill,
                target: independent.target,
                output: independent.finalOutput
            });
        }

        const effects = [
            `Round ${roundNumber} Complete`,
            `${results.summary.totalActions} total actions`,
            `${results.summary.clashCount} clashes`,
            `${results.summary.independentCount} independent actions`
        ];

        let description = `=== ROUND ${roundNumber} RESOLUTION ===\n\n`;

        description += `SUBMITTED ACTIONS:\n`;
        for (const action of roundSummary.actionBreakdown) {
            if (action.type === 'clash') {
                description += `• ${action.actors[0]} uses ${action.skills[0]} vs ${action.actors[1]} uses ${action.skills[1]}\n`;
            } else {
                description += `• ${action.actor} uses ${action.skill} on ${action.target}\n`;
            }
        }
        description += `\n`;

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
