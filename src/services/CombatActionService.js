import { AppDataSource } from '../data-source.js';
import { CombatRound } from '../models/combatRoundModel.js';
import { CombatAction } from '../models/combatActionModel.js';
import { Character } from '../models/characterModel.js';
import { SkillUsageService } from './SkillUsageService.js';
import { TargetResolutionService } from './TargetResolutionService.js';
import { SkillExecutionService } from './SkillExecutionService.js';
import { HttpError } from '../utils/HttpError.js';

export class CombatActionService {
    constructor() {
        this.roundRepository = AppDataSource.getRepository(CombatRound);
        this.actionRepository = AppDataSource.getRepository(CombatAction);
        this.characterRepository = AppDataSource.getRepository(Character);
        this.targetResolutionService = new TargetResolutionService();
        this.skillExecutionService = new SkillExecutionService();
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
        const round = await this.roundRepository.findOne({
            where: { id: roundId, status: 'active' }
        });

        if (!round) {
            throw new HttpError(404, 'Combat round not found or not active');
        }

        const existingAction = await this.actionRepository.findOne({
            where: { roundId, characterId }
        });

        if (existingAction) {
            throw new HttpError(409, 'Character has already submitted an action for this round');
        }

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

        if (!character) throw new HttpError(404, 'Character not found');
        if (!skill) throw new HttpError(404, 'Skill not found');

        const targetResolution = await this.targetResolutionService.resolveSkillTarget(
            skill,
            character,
            targetId,
            { includeRelations: true, activeOnly: true }
        );

        if (!targetResolution.isValid) {
            throw new HttpError(400, targetResolution.error);
        }

        const calculationResult = await this.skillExecutionService.calculateSkillOutput(
            character,
            skill,
            { preCalculated: preCalculatedValues, useCache: true }
        );

        if (!calculationResult.success) {
            throw new HttpError(400, `Skill calculation failed: ${calculationResult.error}`);
        }

        const { finalOutput, outcomeMultiplier, rollQuality } = calculationResult;

        const action = this.actionRepository.create({
            roundId,
            characterId,
            skillId,
            targetId: targetResolution.targetId,
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
            targetData: targetResolution.target ? {
                id: targetResolution.target.id,
                name: targetResolution.target.name
            } : null
        });

        const savedAction = await this.actionRepository.save(action);

        await SkillUsageService.incrementSkillUsage(characterId, skillId, skill.branchId);

        return savedAction;
    }
}
