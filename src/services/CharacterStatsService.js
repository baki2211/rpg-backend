import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { StatDefinitionService } from './StatDefinitionService.js';
import { RankService } from './RankService.js';

const PRIMARY_STAT_POINT_POOL = 45;
const DEFAULT_STAT_MAX = 100;

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
          throw new Error(`${statDef.displayName} must be between ${statDef.minValue} and ${maxValue}`);
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
    const errors = [];
    const warnings = [];

    for (const statDef of statDefinitions) {
      const value = stats[statDef.internalName];
      const maxValue = statDef.maxValue ?? DEFAULT_STAT_MAX;

      if (value === undefined || value === null) {
        if (statDef.category === 'primary_stat') {
          errors.push(`Missing required stat: ${statDef.displayName}`);
        }
        continue;
      }

      if (typeof value !== 'number') {
        errors.push(`${statDef.displayName} must be a number`);
        continue;
      }

      if (value < statDef.minValue) {
        errors.push(`${statDef.displayName} cannot be less than ${statDef.minValue}`);
      }

      if (value > maxValue) {
        errors.push(`${statDef.displayName} cannot be greater than ${maxValue}`);
      }
    }

    for (const statName in stats) {
      const statDef = statDefinitions.find(def => def.internalName === statName);
      if (!statDef) {
        warnings.push(`Unknown stat: ${statName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async calculateStatPointsUsed(stats) {
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    let totalPoints = 0;

    for (const statDef of primaryStats) {
      const value = stats[statDef.internalName] || statDef.defaultValue;
      totalPoints += value;
    }

    return totalPoints;
  }

  async updateCharacterStats(characterId, userId, statUpdates) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: ['skills', 'skills.branch', 'skills.type', 'race']
    });
    if (!character) {
      throw new Error('Character not found');
    }

    const updatedStats = { ...character.stats, ...statUpdates };

    const validation = await this.validateCharacterStats(updatedStats);
    if (!validation.isValid) {
      throw new Error(`Stat validation failed: ${validation.errors.join(', ')}`);
    }

    const totalPrimaryStatPoints = await this.calculateStatPointsUsed(updatedStats);
    if (totalPrimaryStatPoints > PRIMARY_STAT_POINT_POOL) {
      throw new Error(`Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed ${PRIMARY_STAT_POINT_POOL} points.`);
    }

    const derived = await this.computeDerivedStats(updatedStats, character.race, character.rank);
    Object.assign(updatedStats, derived);

    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { stats: updatedStats }
    );

    return this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: ['skills', 'skills.branch', 'skills.type', 'race']
    });
  }

  async getCharacterStatsWithDefinitions(characterId, userId) {
    const character = await this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: ['skills', 'skills.branch', 'skills.type', 'race']
    });
    if (!character) {
      throw new Error('Character not found');
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

  async checkLevelUp(character) {
    let nextRank = await this.rankService.getNextRank(character.rank);
    let leveledUp = false;
    while (nextRank && character.experience >= nextRank.requiredExperience) {
      character.rank = nextRank.level;
      character.statPoints += nextRank.statPoints;
      character.skillPoints += nextRank.skillPoints;

      if (nextRank.aetherPercent && character.stats.aether !== undefined) {
        character.stats.aether = Math.floor(character.stats.aether * (1 + nextRank.aetherPercent / 100));
      }
      if (nextRank.hpPercent && character.stats.hp !== undefined) {
        character.stats.hp = Math.floor(character.stats.hp * (1 + nextRank.hpPercent / 100));
      }

      leveledUp = true;
      nextRank = await this.rankService.getNextRank(character.rank);
    }
    if (leveledUp) {
      await this.characterRepository.save(character);
    }
    return leveledUp;
  }

  async computeDerivedStats(baseStats, race, rankLevel) {
    const rank = await this.rankService.getRank(rankLevel) || { hpPercent: 0, aetherPercent: 0 };

    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);

    const statValues = {};
    let primarySum = 0;

    for (const statDef of primaryStats) {
      const baseValue = baseStats[statDef.internalName] || 0;
      const raceBonus = race?.[`${statDef.internalName}Bonus`] || 0;
      const finalValue = baseValue + raceBonus;
      statValues[statDef.internalName] = finalValue;
      primarySum += finalValue;
    }

    const FOC = statValues.foc || 0;
    const CON = statValues.con || 0;
    const RES = statValues.res || 0;
    const INS = statValues.ins || 0;
    const FOR = statValues.for || 0;

    const reactions = ((INS + FOC) / 2) + (INS * 0.165);

    const BSP = race?.speedBonus || 0;
    const speed = ((FOR + CON + RES) / 3) + (FOR * 0.165) + BSP;

    const BHP = race?.healthBonus || 0;
    const baseHP = ((RES * 2) + (CON * 3)) + BHP;
    const hp = Math.floor(baseHP * (1 + (rank.hpPercent || 0) / 100));

    const BAE = race?.manaBonus || 0;
    const baseAE = BAE + Math.sqrt(primarySum) * 5;
    const aether = Math.floor(baseAE * (1 + (rank.aetherPercent || 0) / 100));

    return { reactions: Math.floor(reactions), speed: Math.floor(speed), hp, aether };
  }
}
