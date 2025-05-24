import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);

  async createCharacter(data, userId, imageUrl) {
    const user = await this.userRepository.findOneBy({ id: (await data.user)?.id || userId });
    if (!user) {
      throw new Error('User not found');
    }
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
    console.log('Race Log:', race);
    if (!race) {
      throw new Error('Race not found');
    }
    // Validate pool of 45 points for stats
    const totalStats = Object.values(data.stats || {}).reduce((sum, val) => sum + val, 0);
    if (totalStats > 45) {
      throw new Error('Total stats exceed the allowed 45 points.');
    }

    // Set all other characters for the user as inactive if this one is active
    if (data.isActive) {
      await this.characterRepository.update({ user }, { isActive: false });
    }

    // Create the new character, using lazy loading for `user`
    const newCharacter = this.characterRepository.create({
      ...data,
      user: user,
      userId: user.id,
      race,
      imageUrl: imageUrl,
    });

    console.log('Creating character for user:', user);
    console.log('Character data:', data);

    return this.characterRepository.save(newCharacter);
  }

  async getCharactersByUser(userId) {
    return this.characterRepository.find({
      where: { user: { id: userId } },
      relations: ['race'], // Load the race relation explicitly
    });
  }

  async getCharacterById(characterId, userId) {
    return this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } }
    });
  }
  
  async updateCharacterImage(characterId, userId, imagePath) {
    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { imagePath }
    );
    return this.getCharacterById(characterId, userId);
  }
  

  async activateCharacter(characterId, userId) {
    // Deactivate all characters first
    await this.characterRepository.update({ user: { id: userId } }, { isActive: false });

    // Activate the chosen character
    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { isActive: true }
    );
  }

  async deleteCharacter(characterId, userId) {
    await this.characterRepository.delete({ id: characterId, user: { id: userId } });
  }

  async getActiveCharacter(userId) {
    return this.characterRepository.findOne({
      where: { user: { id: userId }, isActive: true },
      relations: ['skills', 'race'] // Load both skills and race relations
    });
  }

  async acquireSkill(skillId, userId) {
    const character = await this.getActiveCharacter(userId);
    if (!character) {
      throw new Error('No active character found');
    }

    const skill = await AppDataSource.getRepository('Skill').findOne({
      where: { id: skillId }
    });

    if (!skill) {
      throw new Error('Skill not found');
    }

    // Check if character already has the skill
    const hasSkill = character.skills?.some(s => s.id === skillId);
    if (hasSkill) {
      throw new Error('Character already has this skill');
    }

    // Check if character has enough skill points
    if (character.skillPoints < skill.skillPointCost) {
      throw new Error('Not enough skill points');
    }

    // Create the many-to-many relationship
    await AppDataSource
      .createQueryBuilder()
      .relation(Character, "skills")
      .of(character)
      .add(skill);

    // Update skill points
    await this.characterRepository.update(
      { id: character.id },
      { skillPoints: character.skillPoints - skill.skillPointCost }
    );

    // Return updated character with skills
    return await this.getActiveCharacter(userId);
  }
}
