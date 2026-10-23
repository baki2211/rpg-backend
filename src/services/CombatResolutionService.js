import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { EngineLogService } from './EngineLogService.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';
import { identifyClashes, resolveActionClash, summarizeIndependentAction } from '../domain/combat/roundClashes.js';

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
                relations: { actions: { character: true, skill: true, target: true } }
            });

            if (!round) {
                throw new HttpError(404, 'Combat round not found or not active');
            }

            const actions = round.actions || [];
            if (actions.length === 0) {
                throw new HttpError(400, 'No actions to resolve');
            }

            const { clashes, independentActions } = identifyClashes(actions);

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
                resolutionResults.independentActions.push(summarizeIndependentAction(independent));
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
                relations: { actions: true }
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
     * Record the clash result on both actions (rule in src/domain/combat/roundClashes.js)
     * @param {[Object, Object]} actions - The two clashing actions
     * @param {Object} manager - Transaction manager
     * @returns {Promise<Object>} Clash resolution result
     */
    async resolveClash([action1, action2], manager) {
        const result = resolveActionClash(action1, action2);

        const actionRepo = manager.getRepository(CombatAction);
        await Promise.all([
            actionRepo.update(action1.id, { clashResult: result }),
            actionRepo.update(action2.id, { clashResult: result })
        ]);

        return result;
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
