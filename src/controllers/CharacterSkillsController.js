import { CharacterSkillsService } from '../services/CharacterSkillsService.js';
import { AuditLogger } from '../utils/auditLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const characterSkillsService = new CharacterSkillsService();

export class CharacterSkillsController {
    static getAvailableSkills = asyncHandler(async (req, res) => {
        const characterId = InputValidator.validateCharacterId(req.params.characterId);
        res.status(200).json(await characterSkillsService.getAvailableSkills(characterId, req.user.id));
    });

    static getAcquiredSkills = asyncHandler(async (req, res) => {
        const characterId = InputValidator.validateCharacterId(req.params.characterId);
        res.status(200).json(await characterSkillsService.getAcquiredSkills(characterId, req.user.id));
    });

    static acquireSkill = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        const skillId = InputValidator.validateSkillId(req.params.skillId);
        const character = await characterSkillsService.acquireSkill(skillId, userId);

        AuditLogger.logEvent(
            AuditLogger.EventTypes.SKILL_ACQUIRE,
            {
                userId,
                characterId: character.id,
                req,
                riskLevel: AuditLogger.RiskLevels.LOW,
                details: { skill_id: skillId }
            }
        );

        res.status(200).json(character);
    });
}
