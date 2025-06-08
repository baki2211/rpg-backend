import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';
import { Skill } from '../models/skillModel.js';
import { logger } from '../utils/logger.js';

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);

  async createCharacter(data, userId, imageUrl) {
    const user = await this.userRepository.findOneBy({ id: (await data.user)?.id || userId });
    if (!user) {
      throw new Error('User not found');
    }
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
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

    // Create the new character, using lazy loading for the `user`
    const newCharacter = this.characterRepository.create({
      ...data,
      user: user,
      userId: user.id,
      race,
      imageUrl: imageUrl,
    });

    logger.character(`Creating character for user ${user.id}`, { characterName: data.name, race: race.name });

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
      where: { id: characterId, user: { id: userId } },
      relations: ['skills', 'skills.branch', 'skills.type']
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
    return await AppDataSource.transaction(async (manager) => {
      // First check if the character exists and belongs to the user
      const characterRepo = manager.getRepository(Character);
      const character = await characterRepo.findOne({
        where: { id: characterId, user: { id: userId } }
      });

      if (!character) {
        throw new Error('Character not found or you do not have permission to delete this character');
      }

      logger.character(`Deleting character ${character.name} (ID: ${characterId}) for user ${userId}`);

      // Clean up related data before deleting the character
      
      // 1. Remove from session participants
      const { SessionParticipant } = await import('../models/sessionParticipantModel.js');
      const sessionParticipantRepo = manager.getRepository(SessionParticipant);
      await sessionParticipantRepo.delete({ characterId });
      logger.character(`Removed character ${characterId} from all sessions`);

      // 2. Remove character skills relationships
      const { CharacterSkill } = await import('../models/characterSkillModel.js');
      const characterSkillRepo = manager.getRepository(CharacterSkill);
      await characterSkillRepo.delete({ characterId });
      logger.character(`Removed skill relationships for character ${characterId}`);

      // 3. Remove character skill branch usage tracking
      const { CharacterSkillBranch } = await import('../models/characterSkillBranchModel.js');
      const characterSkillBranchRepo = manager.getRepository(CharacterSkillBranch);
      await characterSkillBranchRepo.delete({ characterId });
      logger.character(`Removed skill branch usage for character ${characterId}`);

      // 4. Update any chat messages to remove character references (optional - we could keep these for history)
      // For now, we'll keep chat messages but they'll just show the character name without being linked

      // 5. Remove from any combat actions (if in active combat)
      try {
        const { CombatAction } = await import('../models/combatActionModel.js');
        const combatActionRepo = manager.getRepository(CombatAction);
        await combatActionRepo.delete({ characterId });
        logger.character(`Removed combat actions for character ${characterId}`);
      } catch (error) {
        // Combat module might not exist, that's ok
        logger.character(`Combat cleanup skipped for character ${characterId}`);
      }

      // Now delete the character
      const result = await characterRepo.delete({ 
        id: characterId, 
        user: { id: userId } 
      });

      if (result.affected === 0) {
        throw new Error('Failed to delete character');
      }

      logger.character(`Successfully deleted character ${character.name} (ID: ${characterId})`);
      return { success: true, deletedCharacterId: characterId };
    });
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

  async getAvailableSkills(characterId, userId) {
    const character = await this.getCharacterById(characterId, userId);
    if (!character) {
      throw new Error('Character not found');
    }

    const allSkills = await AppDataSource.getRepository(Skill).find({
      relations: ['branch', 'type']
    });

    // Filter out skills that the character already has
    const availableSkills = allSkills.filter(skill => 
      !character.skills?.some(characterSkill => characterSkill.id === skill.id)
    );

    return availableSkills;
  }

  async getAcquiredSkills(characterId, userId) {
    const character = await this.getCharacterById(characterId, userId);
    if (!character) {
      throw new Error('Character not found');
    }

    // Return the character's skills with their relations
    return character.skills;
  }
}
