import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterService } from './CharacterService.js';
import { HttpError } from '../utils/HttpError.js';
import { lockCharacter } from '../utils/rowLocks.js';
import { planSkillAcquisition } from '../domain/skills/acquisition.js';

// HTTP status for each reason planSkillAcquisition refuses
const REFUSAL_STATUS = { already_known: 409, not_enough_points: 400 };

export class CharacterSkillsService {
  skillRepository = AppDataSource.getRepository(Skill);
  characterService = new CharacterService();

  /**
   * Learn a skill with the active character's skill points. The points are spent and the
   * character_skills row is added in one transaction, on the locked character row, so two
   * concurrent requests can't spend the same points.
   */
  async acquireSkill(skillId, userId) {
    const character = await this.characterService.getActiveCharacter(userId);
    if (!character) {
      throw new HttpError(404, 'No active character found');
    }

    const skill = await this.skillRepository.findOne({ where: { id: skillId } });
    if (!skill) {
      throw new HttpError(404, 'Skill not found');
    }

    await AppDataSource.transaction(async (manager) => {
      const { skillPoints } = await lockCharacter(manager, character.id);
      const alreadyKnown = await manager.getRepository(CharacterSkill).existsBy({ characterId: character.id, skillId: skill.id });

      const plan = planSkillAcquisition({ skillPoints, skillPointCost: skill.skillPointCost, alreadyKnown });
      if (!plan.allowed) {
        throw new HttpError(REFUSAL_STATUS[plan.reason], plan.error);
      }

      await manager.insert(CharacterSkill, { characterId: character.id, skillId: skill.id });
      await manager.update(Character, { id: character.id }, { skillPoints: plan.remainingSkillPoints });
    });

    return this.characterService.getActiveCharacter(userId);
  }

  async getAvailableSkills(characterId, userId) {
    const character = await this.characterService.getCharacterById(characterId, userId);
    if (!character) {
      throw new HttpError(404, 'Character not found');
    }

    const allSkills = await this.skillRepository.find({ relations: { branch: true, type: true } });

    return allSkills.filter(
      skill => !character.skills?.some(characterSkill => characterSkill.id === skill.id)
    );
  }

  async getAcquiredSkills(characterId, userId) {
    const character = await this.characterService.getCharacterById(characterId, userId);
    if (!character) {
      throw new HttpError(404, 'Character not found');
    }
    return character.skills;
  }
}
