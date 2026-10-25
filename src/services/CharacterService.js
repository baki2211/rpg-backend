import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';
import { CharacterStatsService } from './CharacterStatsService.js';
import { HttpError } from '../utils/HttpError.js';
import { PRIMARY_STAT_POINT_POOL, exceedsPrimaryStatPool } from '../domain/character/statPoints.js';
import { imageFileToDelete } from '../domain/character/characterImage.js';
import { logger } from '../utils/logger.js';
import { Not } from 'typeorm';
import { lockUser, lockCharacter } from '../utils/rowLocks.js';
import { lockImageFiles, isImageUrlReferenced } from '../utils/uploadedFiles.js';

// Fields a player may set when creating a character. Progression (rank, experience, skillPoints,
// statPoints), ownership (userId, createdBy) and isNPC are server-controlled.
const CLIENT_CREATABLE_FIELDS = ['name', 'surname', 'age', 'gender', 'background'];

const pickClientFields = (data) => Object.fromEntries(
  CLIENT_CREATABLE_FIELDS.filter(field => data[field] !== undefined).map(field => [field, data[field]])
);

/**
 * Stop the user playing anything: every character carrying their userId is deactivated, and the NPCs
 * among them are released (userId cleared). `exceptId` is left untouched. Every activation path calls
 * this inside its transaction, holding the user's row lock, before it activates the chosen character.
 * @param {import('typeorm').EntityManager} manager
 * @param {number} userId
 * @param {number|null} [exceptId] - The character about to be activated, if it already exists
 */
export async function standDownPlayedCharacters(manager, userId, exceptId = null) {
  const others = exceptId == null ? {} : { id: Not(exceptId) };
  await manager.update(Character, { userId, ...others }, { isActive: false });
  await manager.update(Character, { userId, isNPC: true, ...others }, { isActive: false, userId: null });
}

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);
  statsService = new CharacterStatsService();

  async createCharacter(data, userId, imageUrl) {
    // The owner is always the authenticated user, never a user id from the request body
    const user = await this.userRepository.findOneBy({ id: userId });
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
    if (exceedsPrimaryStatPool(totalPrimaryStatPoints)) {
      throw new HttpError(400, `Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed ${PRIMARY_STAT_POINT_POOL} points.`);
    }

    const activate = data.isActive === true;

    const newCharacter = this.characterRepository.create({
      ...pickClientFields(data),
      isActive: activate,
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

    // Deactivating the others and inserting the new active character commit together
    return AppDataSource.transaction(async (manager) => {
      if (activate) {
        await lockUser(manager, user.id);
        await standDownPlayedCharacters(manager, user.id);
      }
      await lockImageFiles(manager, [imageUrl]);
      return manager.getRepository(Character).save(newCharacter);
    });
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

  /**
   * Point the user's character at a new image URL, in one transaction with the character row locked.
   * The old file is not touched here: the caller deletes `fileToDelete` only after this commits
   * (deleteImageFileIfUnreferenced), so the database never points at a file that was already removed.
   * It is null when the old URL owns no file or another character or a map still points at it.
   * @returns {Promise<{ character: Object, fileToDelete: string|null }>}
   */
  async updateCharacterImage(characterId, userId, imageUrl) {
    const fileToDelete = await AppDataSource.transaction(async (manager) => {
      const character = await lockCharacter(manager, characterId);
      if (!character || character.userId !== userId) {
        throw new HttpError(404, 'Character not found');
      }

      const previousUrl = character.imageUrl;
      await lockImageFiles(manager, [previousUrl, imageUrl]);
      await manager.update(Character, { id: characterId }, { imageUrl });

      // Runs after the update, so this character's own row no longer matches the old URL.
      return imageFileToDelete(previousUrl, await isImageUrlReferenced(manager, previousUrl));
    });

    return { character: await this.getCharacterById(characterId, userId), fileToDelete };
  }

  /**
   * Make one of the user's characters the active one. Every other character of the user is
   * deactivated and any NPC they control is released, in the same transaction, so the user
   * always ends up with exactly one active character.
   */
  async activateCharacter(characterId, userId) {
    const character = await AppDataSource.transaction(async (manager) => {
      // Serializes concurrent activations by the same user
      await lockUser(manager, userId);

      const character = await manager.getRepository(Character).findOne({
        where: { id: characterId, user: { id: userId } }
      });

      if (!character) {
        throw new HttpError(404, 'Character not found or you do not have permission to activate this character');
      }

      await standDownPlayedCharacters(manager, userId, characterId);
      await manager.update(Character, { id: characterId }, { isActive: true });
      return character;
    });

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

  /**
   * The character the user is playing: their active character or the NPC they control.
   * Read-only. Activation (activateCharacter, NPCService.activateNPC, createCharacter) keeps a
   * single active row; if older data still has several, the most recently updated one is returned.
   */
  async getActiveCharacter(userId) {
    const character = await this.characterRepository.findOne({
      where: [
        { user: { id: userId }, isActive: true },
        { userId, isNPC: true, isActive: true }
      ],
      relations: { characterSkills: { skill: true }, race: true },
      order: { updatedAt: 'DESC', id: 'DESC' }
    });
    if (character) character.skills = character.characterSkills?.map(cs => cs.skill) ?? [];
    return character;
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
