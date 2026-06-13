import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { CharacterService } from './CharacterService.js';
import { HttpError } from '../utils/HttpError.js';

export class CharacterSkillsService {
  characterRepository = AppDataSource.getRepository(Character);
  skillRepository = AppDataSource.getRepository(Skill);
  characterService = new CharacterService();

  async acquireSkill(skillId, userId) {
    const character = await this.characterService.getActiveCharacter(userId);
    if (!character) {
      throw new HttpError(404, 'No active character found');
    }

    const skill = await this.skillRepository.findOne({ where: { id: skillId } });
    if (!skill) {
      throw new HttpError(404, 'Skill not found');
    }

    const hasSkill = character.skills?.some(s => s.id === skillId);
    if (hasSkill) {
      throw new HttpError(409, 'Character already has this skill');
    }

    if (character.skillPoints < skill.skillPointCost) {
      throw new HttpError(400, 'Not enough skill points');
    }

    await AppDataSource
      .createQueryBuilder()
      .relation(Character, 'skills')
      .of(character)
      .add(skill);

    await this.characterRepository.update(
      { id: character.id },
      { skillPoints: character.skillPoints - skill.skillPointCost }
    );

    return this.characterService.getActiveCharacter(userId);
  }

  async getAvailableSkills(characterId, userId) {
    const character = await this.characterService.getCharacterById(characterId, userId);
    if (!character) {
      throw new HttpError(404, 'Character not found');
    }

    const allSkills = await this.skillRepository.find({ relations: ['branch', 'type'] });

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
