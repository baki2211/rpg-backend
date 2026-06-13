import { PvPService } from '../services/PvPService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const pvpService = new PvPService();

export class PvPController {
    static resolvePvPEncounter = asyncHandler(async (req, res) => {
        const { attackerId, attackerSkillId, defenderId, defenderSkillId } = req.body;
        if (!attackerId || !attackerSkillId || !defenderId || !defenderSkillId) {
            throw new HttpError(400, 'Missing required fields: attackerId, attackerSkillId, defenderId, defenderSkillId');
        }
        res.json(await pvpService.resolvePvPEncounter(attackerId, attackerSkillId, defenderId, defenderSkillId));
    });

    static getCharacterPvPSkills = asyncHandler(async (req, res) => {
        res.json(await pvpService.getCharacterPvPSkills(parseInt(req.params.characterId), req.user.id));
    });

    static simulateSkillOutput = asyncHandler(async (req, res) => {
        const { characterId, skillId } = req.body;
        if (!characterId || !skillId) {
            throw new HttpError(400, 'characterId and skillId are required');
        }
        res.json(await pvpService.simulateSkillOutput(characterId, skillId, req.user.id));
    });
}
