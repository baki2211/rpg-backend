import { AppDataSource } from '../data-source.js';
import { Skill } from '../models/skillModel.js';
import { CharacterService } from './CharacterService.js';
import { PvPResolutionService } from './PvPResolutionService.js';
import { SkillEngine } from './SkillEngine.js';
import { HttpError } from '../utils/HttpError.js';

export class PvPService {
    characterService = new CharacterService();
    skillRepository = AppDataSource.getRepository(Skill);

    async resolvePvPEncounter(attackerId, attackerSkillId, defenderId, defenderSkillId) {
        const [attacker, defender] = await Promise.all([
            this.characterService.findCharacterWithSkillsAndRace(attackerId),
            this.characterService.findCharacterWithSkillsAndRace(defenderId),
        ]);
        if (!attacker) throw new HttpError(404, 'Attacker character not found');
        if (!defender) throw new HttpError(404, 'Defender character not found');

        const [attackerSkill, defenderSkill] = await Promise.all([
            this.skillRepository.findOne({ where: { id: attackerSkillId }, relations: { branch: true, type: true } }),
            this.skillRepository.findOne({ where: { id: defenderSkillId }, relations: { branch: true, type: true } }),
        ]);
        if (!attackerSkill) throw new HttpError(404, 'Attacker skill not found');
        if (!defenderSkill) throw new HttpError(404, 'Defender skill not found');

        if (!attacker.skills?.some(skill => skill.id === attackerSkillId)) {
            throw new HttpError(400, 'Attacker does not have the specified skill');
        }
        if (!defender.skills?.some(skill => skill.id === defenderSkillId)) {
            throw new HttpError(400, 'Defender does not have the specified skill');
        }

        return PvPResolutionService.resolvePvPEncounter(attacker, attackerSkill, defender, defenderSkill);
    }

    async getCharacterPvPSkills(characterId, userId) {
        const character = await this.characterService.getCharacterById(characterId, userId);
        if (!character) throw new HttpError(404, 'Character not found');
        return character.skills?.filter(skill => skill.target === 'other' || skill.target === 'none') ?? [];
    }

    async simulateSkillOutput(characterId, skillId, userId) {
        const character = await this.characterService.getCharacterById(characterId, userId);
        if (!character) throw new HttpError(404, 'Character not found');

        const skill = await this.skillRepository.findOne({
            where: { id: skillId },
            relations: { branch: true, type: true },
        });
        if (!skill) throw new HttpError(404, 'Skill not found');

        if (!character.skills?.some(s => s.id === skillId)) {
            throw new HttpError(400, 'Character does not have this skill');
        }

        const skillEngine = new SkillEngine(character, skill);
        const estimatedOutput = await skillEngine.computeFinalOutput();

        return {
            character: character.name,
            skill: skill.name,
            estimatedOutput,
            skillType: skill.type?.name,
            target: skill.target,
        };
    }
}
