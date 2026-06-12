import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Race } from '../models/raceModel.js';
import { CharacterStatsService } from './CharacterStatsService.js';
import { logger } from '../utils/logger.js';
import { Not } from 'typeorm';

export class NPCService {
  characterRepository = AppDataSource.getRepository(Character);
  statsService = new CharacterStatsService();

  async createNPC(data, createdBy, imageUrl = null) {
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
    if (!race) {
      throw new Error('Race not found');
    }

    const initializedStats = await this.statsService.initializeCharacterStats(data.stats || {});

    const derived = await this.statsService.computeDerivedStats(initializedStats, race, data.rank || 1);
    Object.assign(initializedStats, derived);

    const newNPC = this.characterRepository.create({
      ...data,
      stats: initializedStats,
      userId: null,
      race,
      imageUrl,
      isNPC: true,
      createdBy,
      isActive: false,
      experience: data.experience || 0,
      skillPoints: data.skillPoints || 5,
      rank: data.rank || 1,
      statPoints: data.statPoints || 0
    });

    logger.character(`Creating NPC character`, {
      characterName: data.name,
      race: race.name,
      stats: initializedStats,
      createdBy
    });

    return this.characterRepository.save(newNPC);
  }

  async getAllNPCs() {
    return this.characterRepository.find({
      where: { isNPC: true },
      relations: ['race', 'creator'],
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
        background: true,
        imageUrl: true,
        createdAt: true,
        race: { id: true, name: true },
        creator: { id: true, username: true }
      },
      order: { name: 'ASC' }
    });
  }

  async updateNPC(npcId, updateData) {
    const npc = await this.characterRepository.findOne({
      where: { id: npcId, isNPC: true },
      relations: ['race']
    });

    if (!npc) {
      throw new Error('NPC not found');
    }

    if (updateData.stats) {
      const updatedStats = { ...npc.stats, ...updateData.stats };
      const derived = await this.statsService.computeDerivedStats(updatedStats, npc.race, updateData.rank || npc.rank);
      Object.assign(updatedStats, derived);
      updateData.stats = updatedStats;
    }

    if (updateData.rank && updateData.rank !== npc.rank) {
      const derived = await this.statsService.computeDerivedStats(updateData.stats || npc.stats, npc.race, updateData.rank);
      updateData.stats = { ...(updateData.stats || npc.stats), ...derived };
    }

    await this.characterRepository.update(npcId, updateData);
    return this.characterRepository.findOne({
      where: { id: npcId },
      relations: ['race', 'creator']
    });
  }

  async deleteNPC(npcId) {
    return await AppDataSource.transaction(async (manager) => {
      const characterRepo = manager.getRepository(Character);
      const npc = await characterRepo.findOne({
        where: { id: npcId, isNPC: true }
      });

      if (!npc) {
        throw new Error('NPC not found');
      }

      if (npc.isActive) {
        throw new Error('Cannot delete an active NPC. Please deactivate it first.');
      }

      logger.character(`Deleting NPC ${npc.name} (ID: ${npcId})`);

      const { SessionParticipant } = await import('../models/sessionParticipantModel.js');
      await manager.getRepository(SessionParticipant).delete({ characterId: npcId });

      const { CharacterSkill } = await import('../models/characterSkillModel.js');
      await manager.getRepository(CharacterSkill).delete({ characterId: npcId });

      const { CharacterSkillBranch } = await import('../models/characterSkillBranchModel.js');
      await manager.getRepository(CharacterSkillBranch).delete({ characterId: npcId });

      try {
        const { CombatAction } = await import('../models/combatActionModel.js');
        const combatActionRepo = manager.getRepository(CombatAction);
        await combatActionRepo.delete({ characterId: npcId });
        await combatActionRepo.delete({ targetId: npcId });
      } catch (error) {
        // Combat module might not exist, that's ok
      }

      const result = await characterRepo.delete({ id: npcId, isNPC: true });

      if (result.affected === 0) {
        throw new Error('Failed to delete NPC');
      }

      logger.character(`Successfully deleted NPC ${npc.name} (ID: ${npcId})`);
      return true;
    });
  }

  async activateNPC(npcId, userId) {
    const npc = await this.characterRepository.findOne({
      where: { id: npcId, isNPC: true },
      relations: ['race', 'skills']
    });

    if (!npc) {
      throw new Error('NPC not found');
    }

    await Promise.all([
      this.characterRepository.update(
        { user: { id: userId } },
        { isActive: false }
      ),
      this.characterRepository.update(
        { userId, isNPC: true, id: Not(npcId) },
        { isActive: false, userId: null }
      )
    ]);

    await this.characterRepository.update(
      { id: npcId },
      { isActive: true, userId }
    );

    logger.character(`User ${userId} activated NPC ${npc.name} (ID: ${npcId})`);

    return this.characterRepository.findOne({
      where: { id: npcId },
      relations: ['race', 'skills']
    });
  }

  async deactivateNPC(npcId, userId) {
    const npc = await this.characterRepository.findOne({
      where: { id: npcId, isNPC: true, userId, isActive: true }
    });

    if (!npc) {
      throw new Error('NPC not found or not active for this user');
    }

    await this.characterRepository.update(
      { id: npcId },
      { isActive: false, userId: null }
    );

    logger.character(`User ${userId} deactivated NPC ${npc.name} (ID: ${npcId})`);
    return true;
  }

  async getAvailableNPCs() {
    return this.characterRepository.find({
      where: { isNPC: true, isActive: false },
      relations: ['race'],
      select: {
        id: true,
        name: true,
        surname: true,
        background: true,
        imageUrl: true,
        rank: true,
        experience: true,
        skillPoints: true,
        race: { id: true, name: true }
      },
      order: { name: 'ASC' }
    });
  }

  async getActiveNPCForUser(userId) {
    return this.characterRepository.findOne({
      where: { userId, isNPC: true, isActive: true },
      relations: ['skills', 'race']
    });
  }

  async isNPC(characterId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId },
      select: { isNPC: true }
    });
    return character?.isNPC || false;
  }
}
