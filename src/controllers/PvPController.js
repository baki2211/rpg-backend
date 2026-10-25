import { In } from 'typeorm';
import { PvPService } from '../services/PvPService.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';
import { canResolvePvPEncounter } from '../domain/combat/pvpAuthorization.js';

const pvpService = new PvPService();

export class PvPController {
    static resolvePvPEncounter = asyncHandler(async (req, res) => {
        const attackerId = InputValidator.validateCharacterId(req.body.attackerId);
        const attackerSkillId = InputValidator.validateSkillId(req.body.attackerSkillId);
        const defenderId = InputValidator.validateCharacterId(req.body.defenderId);
        const defenderSkillId = InputValidator.validateSkillId(req.body.defenderSkillId);

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
        const characterId = InputValidator.validateCharacterId(req.params.characterId);
        res.json(await pvpService.getCharacterPvPSkills(characterId, req.user.id));
    });

    static simulateSkillOutput = asyncHandler(async (req, res) => {
        const characterId = InputValidator.validateCharacterId(req.body.characterId);
        const skillId = InputValidator.validateSkillId(req.body.skillId);
        res.json(await pvpService.simulateSkillOutput(characterId, skillId, req.user.id));
    });
}
