import { CharacterSkillsService } from '../services/CharacterSkillsService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const characterSkillsService = new CharacterSkillsService();

export class CharacterSkillsController {
    static getAvailableSkills = asyncHandler(async (req, res) => {
        const { characterId } = req.params;
        res.status(200).json(await characterSkillsService.getAvailableSkills(Number(characterId), req.user.id));
    });

    static getAcquiredSkills = asyncHandler(async (req, res) => {
        const { characterId } = req.params;
        res.status(200).json(await characterSkillsService.getAcquiredSkills(Number(characterId), req.user.id));
    });

    static acquireSkill = asyncHandler(async (req, res) => {
        const { skillId } = req.params;
        res.status(200).json(await characterSkillsService.acquireSkill(Number(skillId), req.user.id));
    });
}
