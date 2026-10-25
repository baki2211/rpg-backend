import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { StatDefinitionService } from './StatDefinitionService.js';
import { RankService } from './RankService.js';
import { Rank } from '../models/rankModel.js';
import { Race } from '../models/raceModel.js';
import { lockCharacter, lockCharacters } from '../utils/rowLocks.js';
import { HttpError } from '../utils/HttpError.js';
import { PRIMARY_STAT_POINT_POOL, primaryStatPointsUsed, exceedsPrimaryStatPool } from '../domain/character/statPoints.js';
import { DEFAULT_STAT_MAX, validateCharacterStats, unknownStatKeys, computeDerivedStats, cumulativeRankBonus, levelUp } from '../domain/character/stats.js';

export class CharacterStatsService {
  characterRepository = AppDataSource.getRepository(Character);
  statDefinitionService = new StatDefinitionService();
  rankService = new RankService();

  async initializeCharacterStats(providedStats = {}) {
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    const resourceStats = await this.statDefinitionService.getAllStatDefinitions('resource', true);

    const stats = {};

    for (const statDef of primaryStats) {
      const providedValue = providedStats[statDef.internalName];
      const maxValue = statDef.maxValue ?? DEFAULT_STAT_MAX;

      if (providedValue !== undefined) {
        if (providedValue < statDef.minValue || providedValue > maxValue) {
          throw new HttpError(400, `${statDef.displayName} must be between ${statDef.minValue} and ${maxValue}`);
        }
        stats[statDef.internalName] = providedValue;
      } else {
        stats[statDef.internalName] = statDef.defaultValue;
      }
    }

    for (const statDef of resourceStats) {
      stats[statDef.internalName] = statDef.defaultValue;
    }

    return stats;
  }

  async validateCharacterStats(stats, category = null) {
    const statDefinitions = await this.statDefinitionService.getAllStatDefinitions(category, true);
    return validateCharacterStats(stats, statDefinitions);
  }

  async calculateStatPointsUsed(stats) {
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    return primaryStatPointsUsed(stats, primaryStats);
  }

  async updateCharacterStats(characterId, userId, statUpdates) {
    const statDefinitions = await this.statDefinitionService.getAllStatDefinitions(null, true);
    const unknownKeys = unknownStatKeys(statUpdates, statDefinitions);
    if (unknownKeys.length > 0) {
      throw new HttpError(400, `Unknown stats: ${unknownKeys.join(', ')}`);
    }

    await AppDataSource.transaction(async (manager) => {
      // Re-read the stats under a row lock so a concurrent skill use or level-up isn't overwritten
      const character = await manager.getRepository(Character).findOne({
        where: { id: characterId, user: { id: userId } },
        relations: { race: true }
      });
      if (!character) {
        throw new HttpError(404, 'Character not found');
      }
      const { stats, rank } = await lockCharacter(manager, characterId);

      const updatedStats = { ...stats, ...statUpdates };

      const validation = await this.validateCharacterStats(updatedStats);
      if (!validation.isValid) {
        throw new HttpError(400, `Stat validation failed: ${validation.errors.join(', ')}`);
      }

      const totalPrimaryStatPoints = await this.calculateStatPointsUsed(updatedStats);
      if (exceedsPrimaryStatPool(totalPrimaryStatPoints)) {
        throw new HttpError(400, `Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed ${PRIMARY_STAT_POINT_POOL} points.`);
      }

      const derived = await this.computeDerivedStats(updatedStats, character.race, rank);
      Object.assign(updatedStats, derived);

      await manager.update(Character, { id: characterId }, { stats: updatedStats });
    });

    const updated = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: { characterSkills: { skill: { branch: true, type: true } }, race: true }
    });
    if (updated) updated.skills = updated.characterSkills?.map(cs => cs.skill) ?? [];
    return updated;
  }

  async getCharacterStatsWithDefinitions(characterId, userId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: { characterSkills: { skill: { branch: true, type: true } }, race: true }
    });
    if (!character) {
      throw new HttpError(404, 'Character not found');
    }

    const statsByCategory = await this.statDefinitionService.getStatsByCategory(true);

    const enhancedStats = {
      primary_stat: [],
      resource: [],
      scaling_stat: []
    };

    for (const [category, statDefs] of Object.entries(statsByCategory)) {
      for (const statDef of statDefs) {
        const currentValue = character.stats[statDef.internalName] ?? statDef.defaultValue;
        const maxValue = statDef.maxValue ?? DEFAULT_STAT_MAX;
        enhancedStats[category].push({
          ...statDef,
          maxValue,
          currentValue,
          isAtMin: currentValue <= statDef.minValue,
          isAtMax: currentValue >= maxValue
        });
      }
    }

    const totalPrimaryStatPoints = await this.calculateStatPointsUsed(character.stats);

    return {
      character: {
        id: character.id,
        name: character.name,
        surname: character.surname
      },
      stats: enhancedStats,
      totalPrimaryStatPoints,
      remainingPrimaryStatPoints: PRIMARY_STAT_POINT_POOL - totalPrimaryStatPoints
    };
  }

  /**
   * Apply every rank the character's experience has reached and save it when it levels up
   * (rule in src/domain/character/stats.js#levelUp), then recompute its derived stats with the new rank.
   * Like a stat update, that writes the maximum into stats.hp / stats.aether. Updates `character` in place.
   * `character` must be the row locked in the caller's transaction (lockCharacter), so the
   * whole-`stats` write can't overwrite a concurrent change.
   * @param {Object} character - Locked character row
   * @param {EntityManager} manager - The caller's transaction
   * @returns {Promise<boolean>} Whether the character leveled up
   */
  async checkLevelUp(character, manager) {
    const ranks = await manager.getRepository(Rank).find({ order: { level: 'ASC' } });
    const { leveledUp, ...progress } = levelUp(character, ranks);
    if (leveledUp) {
      const race = await manager.getRepository(Race).findOneBy({ id: character.raceId });
      const primaryStatNames = await this.primaryStatNames();
      const derived = computeDerivedStats({
        baseStats: character.stats,
        race,
        rankBonus: cumulativeRankBonus(ranks, progress.rank),
        primaryStatNames
      });
      Object.assign(character, progress, { stats: { ...character.stats, ...derived } });
      await manager.save(Character, character);
    }
    return leveledUp;
  }

  async computeDerivedStats(baseStats, race, rankLevel) {
    const [ranks, primaryStatNames] = await Promise.all([this.rankService.getAllRanks(), this.primaryStatNames()]);
    return computeDerivedStats({ baseStats, race, rankBonus: cumulativeRankBonus(ranks, rankLevel), primaryStatNames });
  }

  /**
   * Recompute the derived stats (reactions, speed, hp, aether) of every character and NPC with the
   * current rule, races and ranks. For rows saved under an older rule. Like a stat update, it writes
   * the maximum into stats.hp / stats.aether, so it also restores current HP and aether.
   * @returns {Promise<{ total: number, updated: number }>} Characters checked, and how many changed
   */
  async recomputeAllDerivedStats() {
    return AppDataSource.transaction(async (manager) => {
      const ids = (await manager.getRepository(Character).find({ select: { id: true } })).map(row => row.id);
      if (ids.length === 0) {
        return { total: 0, updated: 0 };
      }
      // One transaction connection: its queries run one after the other
      const characters = await lockCharacters(manager, ids);
      const ranks = await manager.getRepository(Rank).find();
      const races = await manager.getRepository(Race).find();
      const primaryStatNames = await this.primaryStatNames();
      const racesById = new Map(races.map(race => [race.id, race]));

      let updated = 0;
      for (const character of characters.values()) {
        const derived = computeDerivedStats({
          baseStats: character.stats,
          race: racesById.get(character.raceId) ?? null,
          rankBonus: cumulativeRankBonus(ranks, character.rank),
          primaryStatNames
        });
        if (Object.entries(derived).some(([statName, value]) => character.stats[statName] !== value)) {
          await manager.update(Character, { id: character.id }, { stats: { ...character.stats, ...derived } });
          updated++;
        }
      }
      return { total: characters.size, updated };
    });
  }

  async primaryStatNames() {
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    return primaryStats.map(stat => stat.internalName);
  }
}
