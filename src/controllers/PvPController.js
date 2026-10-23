import { In } from 'typeorm';
import { PvPService } from '../services/PvPService.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { canResolvePvPEncounter } from '../domain/combat/pvpAuthorization.js';

const pvpService = new PvPService();

// Body ids must be positive integers; anything else is a 400 (TypeORM 1.0 throws on undefined in `where`)
const parseId = (raw) => {
    const id = Number(raw);
    return raw != null && raw !== '' && Number.isInteger(id) && id > 0 ? id : null;
};

export class PvPController {
    static resolvePvPEncounter = asyncHandler(async (req, res) => {
        const attackerId = parseId(req.body.attackerId);
        const attackerSkillId = parseId(req.body.attackerSkillId);
        const defenderId = parseId(req.body.defenderId);
        const defenderSkillId = parseId(req.body.defenderSkillId);
        if (!attackerId || !attackerSkillId || !defenderId || !defenderSkillId) {
            throw new HttpError(400, 'Missing required fields: attackerId, attackerSkillId, defenderId, defenderSkillId');
        }

        const owners = await AppDataSource.getRepository(Character).find({
            where: { id: In([attackerId, defenderId]) },
            select: { id: true, userId: true },
        });
        const ownerOf = (characterId) => owners.find(character => character.id === characterId)?.userId;

        const allowed = canResolvePvPEncounter({
            userId: req.user.id,
            role: req.user.role,
            attackerOwnerId: ownerOf(attackerId),
            defenderOwnerId: ownerOf(defenderId),
        });
        if (!allowed) {
            throw new HttpError(403, 'You can only resolve encounters involving your own characters');
        }

        res.json(await pvpService.resolvePvPEncounter(attackerId, attackerSkillId, defenderId, defenderSkillId));
    });

    static getCharacterPvPSkills = asyncHandler(async (req, res) => {
        const characterId = parseId(req.params.characterId);
        if (!characterId) {
            throw new HttpError(400, 'Invalid character ID provided');
        }
        res.json(await pvpService.getCharacterPvPSkills(characterId, req.user.id));
    });

    static simulateSkillOutput = asyncHandler(async (req, res) => {
        const characterId = parseId(req.body.characterId);
        const skillId = parseId(req.body.skillId);
        if (!characterId || !skillId) {
            throw new HttpError(400, 'characterId and skillId are required');
        }
        res.json(await pvpService.simulateSkillOutput(characterId, skillId, req.user.id));
    });
}
