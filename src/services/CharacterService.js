import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';
import { CharacterStatsService } from './CharacterStatsService.js';
import { HttpError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';
import { Not } from 'typeorm';

const PRIMARY_STAT_POINT_POOL = 45;

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);
  statsService = new CharacterStatsService();

  async createCharacter(data, userId, imageUrl) {
    const user = await this.userRepository.findOneBy({ id: data.user?.id || userId });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
    if (!race) {
      throw new HttpError(404, 'Race not found');
    }

    const initializedStats = await this.statsService.initializeCharacterStats(data.stats || {});
    const validation = await this.statsService.validateCharacterStats(initializedStats, 'primary_stat');

    if (!validation.isValid) {
      throw new HttpError(400, `Stat validation failed: ${validation.errors.join(', ')}`);
    }

    const derived = await this.statsService.computeDerivedStats(initializedStats, race, 1);
    Object.assign(initializedStats, derived);

    const totalPrimaryStatPoints = await this.statsService.calculateStatPointsUsed(initializedStats);
    if (totalPrimaryStatPoints > PRIMARY_STAT_POINT_POOL) {
      throw new HttpError(400, `Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed ${PRIMARY_STAT_POINT_POOL} points.`);
    }

    if (data.isActive) {
      await this.characterRepository.update({ user }, { isActive: false });
    }

    const newCharacter = this.characterRepository.create({
      ...data,
      stats: initializedStats,
      user,
      userId: user.id,
      race,
      imageUrl,
    });

    logger.character(`Creating character for user ${user.id}`, {
      characterName: data.name,
      race: race.name,
      stats: initializedStats
    });

    return this.characterRepository.save(newCharacter);
  }

  async getCharactersByUser(userId) {
    return this.characterRepository.find({
      where: { user: { id: userId } },
      relations: { race: true },
    });
  }

  async getAllCharacters() {
    return this.characterRepository.find({
      relations: { race: true, user: true },
      select: {
        id: true,
        name: true,
        surname: true,
        stats: true,
        rank: true,
        experience: true,
        skillPoints: true,
        statPoints: true,
        isActive: true,
        race: { id: true, name: true },
        user: { id: true, username: true }
      },
      order: { name: 'ASC' }
    });
  }

  async getCharacterById(characterId, userId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: { characterSkills: { skill: { branch: true, type: true } }, race: true }
    });
    if (character) character.skills = character.characterSkills?.map(cs => cs.skill) ?? [];
    return character;
  }

  async findCharacterWithSkillsAndRace(characterId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
      relations: { characterSkills: { skill: true }, race: true }
    });
    if (character) character.skills = character.characterSkills?.map(cs => cs.skill) ?? [];
    return character;
  }

  async updateCharacterImage(characterId, userId, imagePath) {
    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { imagePath }
    );
    return this.getCharacterById(characterId, userId);
  }

  async activateCharacter(characterId, userId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } }
    });

    if (!character) {
      throw new HttpError(404, 'Character not found or you do not have permission to activate this character');
    }

    await Promise.all([
      this.characterRepository.update(
        { user: { id: userId }, id: Not(characterId) },
        { isActive: false }
      ),
      this.characterRepository.update(
        { userId, isNPC: true },
        { isActive: false, userId: null }
      )
    ]);

    await this.characterRepository.update(
      { id: characterId },
      { isActive: true }
    );

    logger.character(`User ${userId} activated character ${character.name} (ID: ${characterId})`);
  }

  async deleteCharacter(characterId, userId) {
    return await AppDataSource.transaction(async (manager) => {
      const characterRepo = manager.getRepository(Character);
      const character = await characterRepo.findOne({
        where: { id: characterId, user: { id: userId } }
      });

      if (!character) {
        throw new HttpError(404, 'Character not found or you do not have permission to delete this character');
      }

      if (character.isActive) {
        throw new HttpError(409, 'Cannot delete an active character. Please deactivate it first.');
      }

      logger.character(`Deleting character ${character.name} (ID: ${characterId}) for user ${userId}`);

      const { SessionParticipant } = await import('../models/sessionParticipantModel.js');
      await manager.getRepository(SessionParticipant).delete({ characterId });
      logger.character(`Removed character ${characterId} from all sessions`);

      const { CharacterSkill } = await import('../models/characterSkillModel.js');
      await manager.getRepository(CharacterSkill).delete({ characterId });
      logger.character(`Removed skill relationships for character ${characterId}`);

      const { CharacterSkillBranch } = await import('../models/characterSkillBranchModel.js');
      await manager.getRepository(CharacterSkillBranch).delete({ characterId });
      logger.character(`Removed skill branch usage for character ${characterId}`);

      try {
        const { CombatAction } = await import('../models/combatActionModel.js');
        const combatActionRepo = manager.getRepository(CombatAction);
        await combatActionRepo.delete({ characterId });
        await combatActionRepo.delete({ targetId: characterId });
        logger.character(`Removed combat actions for character ${characterId}`);
      } catch (error) {
        logger.character(`Combat cleanup skipped for character ${characterId}`);
      }

      const result = await characterRepo.delete({
        id: characterId,
        user: { id: userId }
      });

      if (result.affected === 0) {
        throw new HttpError(500, 'Failed to delete character');
      }

      logger.character(`Successfully deleted character ${character.name} (ID: ${characterId})`);
      return { success: true, deletedCharacterId: characterId };
    });
  }

  async getActiveCharacter(userId) {
    await this.fixActivationConflicts(userId);

    const character = await this.characterRepository.findOne({
      where: [
        { user: { id: userId }, isActive: true },
        { userId, isNPC: true, isActive: true }
      ],
      relations: { characterSkills: { skill: true }, race: true }
    });
    if (character) character.skills = character.characterSkills?.map(cs => cs.skill) ?? [];
    return character;
  }

  async fixActivationConflicts(userId) {
    const activeCharacters = await this.characterRepository.find({
      where: [
        { user: { id: userId }, isActive: true },
        { userId, isNPC: true, isActive: true }
      ]
    });

    if (activeCharacters.length > 1) {
      logger.character(`Found ${activeCharacters.length} active characters for user ${userId}, fixing conflicts`);

      activeCharacters.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      const toKeep = activeCharacters[0];
      const toDeactivate = activeCharacters.slice(1);

      for (const character of toDeactivate) {
        await this.characterRepository.update(
          { id: character.id },
          {
            isActive: false,
            userId: character.isNPC ? null : character.userId
          }
        );
        logger.character(`Deactivated conflicting character: ${character.name} (ID: ${character.id})`);
      }

      logger.character(`Kept active character: ${toKeep.name} (ID: ${toKeep.id})`);
    }
  }

  async getUserCharacterStatus(userId) {
    const userCharacters = await this.characterRepository.find({
      where: { user: { id: userId } },
      relations: { race: true },
      select: {
        id: true,
        name: true,
        surname: true,
        isActive: true,
        isNPC: true,
        userId: true,
        updatedAt: true,
        race: { name: true }
      }
    });

    const assignedNPCs = await this.characterRepository.find({
      where: { userId, isNPC: true },
      relations: { race: true },
      select: {
        id: true,
        name: true,
        surname: true,
        isActive: true,
        isNPC: true,
        userId: true,
        updatedAt: true,
        race: { name: true }
      }
    });

    const activeCount = [...userCharacters, ...assignedNPCs].filter(c => c.isActive).length;

    return {
      userId,
      userCharacters,
      assignedNPCs,
      totalCharacters: userCharacters.length,
      totalAssignedNPCs: assignedNPCs.length,
      activeCount,
      hasConflict: activeCount > 1
    };
  }
}
