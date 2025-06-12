import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';
import { Skill } from '../models/skillModel.js';
import { StatDefinitionService } from './StatDefinitionService.js';
import { logger } from '../utils/logger.js';
import { RankService } from './RankService.js';

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);
  statDefinitionService = new StatDefinitionService();
  rankService = new RankService();

  /**
   * Initialize character stats based on stat definitions
   * @param {Object} providedStats - Stats provided during character creation
   * @returns {Promise<Object>} Initialized stats object
   */
  async initializeCharacterStats(providedStats = {}) {
    // Get primary stats (the ones used in character creation)
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    const resourceStats = await this.statDefinitionService.getAllStatDefinitions('resource', true);
    
    const stats = {};
    
    // Initialize primary stats with provided values or defaults
    for (const statDef of primaryStats) {
      const providedValue = providedStats[statDef.internalName];
      const maxValue = statDef.maxValue ?? 100; // Default to 100 if null
      
      if (providedValue !== undefined) {
        // Validate the provided value
        if (providedValue < statDef.minValue || providedValue > maxValue) {
          throw new Error(`${statDef.displayName} must be between ${statDef.minValue} and ${maxValue}`);
        }
        stats[statDef.internalName] = providedValue;
      } else {
        stats[statDef.internalName] = statDef.defaultValue;
      }
    }
    
    // Initialize resource stats with default values
    for (const statDef of resourceStats) {
      stats[statDef.internalName] = statDef.defaultValue;
    }
    
    return stats;
  }

  /**
   * Validate character stats against stat definitions
   * @param {Object} stats - Stats to validate
   * @param {string} category - Optional category filter
   * @returns {Promise<Object>} Validation result
   */
  async validateCharacterStats(stats, category = null) {
    const statDefinitions = await this.statDefinitionService.getAllStatDefinitions(category, true);
    const errors = [];
    const warnings = [];
    
    // Validate each stat
    for (const statDef of statDefinitions) {
      const value = stats[statDef.internalName];
      const maxValue = statDef.maxValue ?? 100; // Default to 100 if null
      
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
    
    // Check for unknown stats
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

  /**
   * Calculate total stat points used (for primary stats only)
   * @param {Object} stats - Character stats
   * @returns {Promise<number>} Total points used
   */
  async calculateStatPointsUsed(stats) {
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    let totalPoints = 0;
    
    for (const statDef of primaryStats) {
      const value = stats[statDef.internalName] || statDef.defaultValue;
      totalPoints += value;
    }
    
    return totalPoints;
  }

  async createCharacter(data, userId, imageUrl) {
    const user = await this.userRepository.findOneBy({ id: (await data.user)?.id || userId });
    if (!user) {
      throw new Error('User not found');
    }
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
    if (!race) {
      throw new Error('Race not found');
    }
    
    // Initialize and validate stats using stat definitions
    const initializedStats = await this.initializeCharacterStats(data.stats || {});
    const validation = await this.validateCharacterStats(initializedStats, 'primary_stat');
    
    if (!validation.isValid) {
      throw new Error(`Stat validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Compute derived resource stats and merge
    const derived = await this.computeDerivedStats(initializedStats, race, 1);
    Object.assign(initializedStats, derived);
    
    // Validate pool of 45 points for primary stats only
    const totalPrimaryStatPoints = await this.calculateStatPointsUsed(initializedStats);
    if (totalPrimaryStatPoints > 45) {
      throw new Error(`Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed 45 points.`);
    }

    // Set all other characters for the user as inactive if this one is active
    if (data.isActive) {
      await this.characterRepository.update({ user }, { isActive: false });
    }

    // Create the new character, using the initialized stats
    const newCharacter = this.characterRepository.create({
      ...data,
      stats: initializedStats,
      user: user,
      userId: user.id,
      race,
      imageUrl: imageUrl,
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
      relations: ['race'], // Load the race relation explicitly
    });
  }

  async getCharacterById(characterId, userId) {
    return this.characterRepository.findOne({
      where: { id: characterId, user: { id: userId } },
      relations: ['skills', 'skills.branch', 'skills.type', 'race']
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
        await combatActionRepo.delete({ targetId: characterId });
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

  /**
   * Update character stats
   * @param {number} characterId - Character ID
   * @param {number} userId - User ID (for permission check)
   * @param {Object} statUpdates - Object with stat updates { statName: newValue }
   * @returns {Promise<Object>} Updated character
   */
  async updateCharacterStats(characterId, userId, statUpdates) {
    const character = await this.getCharacterById(characterId, userId);
    if (!character) {
      throw new Error('Character not found');
    }

    // Merge the updates with existing stats
    const updatedStats = { ...character.stats, ...statUpdates };
    
    // Validate the updated stats
    const validation = await this.validateCharacterStats(updatedStats);
    if (!validation.isValid) {
      throw new Error(`Stat validation failed: ${validation.errors.join(', ')}`);
    }

    // For primary stats, check the 45-point limit
    const totalPrimaryStatPoints = await this.calculateStatPointsUsed(updatedStats);
    if (totalPrimaryStatPoints > 45) {
      throw new Error(`Total primary stat points (${totalPrimaryStatPoints}) exceed the allowed 45 points.`);
    }

    // recompute derived resources
    const derived = await this.computeDerivedStats(updatedStats, character.race, character.rank);
    Object.assign(updatedStats, derived);

    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { stats: updatedStats }
    );

    return this.getCharacterById(characterId, userId);
  }

  /**
   * Get character stats with stat definition metadata
   * @param {number} characterId - Character ID
   * @param {number} userId - User ID (for permission check)
   * @returns {Promise<Object>} Character stats with metadata
   */
  async getCharacterStatsWithDefinitions(characterId, userId) {
    const character = await this.getCharacterById(characterId, userId);
    if (!character) {
      throw new Error('Character not found');
    }

    // Get all stat definitions organized by category
    const statsByCategory = await this.statDefinitionService.getStatsByCategory(true);
    
    // Enhance character stats with definition metadata
    const enhancedStats = {
      primary_stat: [],
      resource: [],
      scaling_stat: []
    };

    for (const [category, statDefs] of Object.entries(statsByCategory)) {
      for (const statDef of statDefs) {
        const currentValue = character.stats[statDef.internalName] ?? statDef.defaultValue;
        const maxValue = statDef.maxValue ?? 100; // Default to 100 if null
        enhancedStats[category].push({
          ...statDef,
          maxValue, // Use the resolved max value
          currentValue,
          isAtMin: currentValue <= statDef.minValue,
          isAtMax: currentValue >= maxValue
        });
      }
    }

    return {
      character: {
        id: character.id,
        name: character.name,
        surname: character.surname
      },
      stats: enhancedStats,
      totalPrimaryStatPoints: await this.calculateStatPointsUsed(character.stats),
      remainingPrimaryStatPoints: 45 - await this.calculateStatPointsUsed(character.stats)
    };
  }

  async checkLevelUp(character) {
    let nextRank = await this.rankService.getNextRank(character.rank);
    let leveledUp = false;
    while (nextRank && character.experience >= nextRank.requiredExperience) {
      character.rank = nextRank.level;
      character.statPoints += nextRank.statPoints;
      character.skillPoints += nextRank.skillPoints;

      // apply percentage bonuses
      if (nextRank.aetherPercent) {
        if (character.stats.aether !== undefined) {
          character.stats.aether = Math.floor(character.stats.aether * (1 + nextRank.aetherPercent / 100));
        }
      }
      if (nextRank.hpPercent) {
        if (character.stats.hp !== undefined) {
          character.stats.hp = Math.floor(character.stats.hp * (1 + nextRank.hpPercent / 100));
        }
      }

      leveledUp = true;
      nextRank = await this.rankService.getNextRank(character.rank);
    }
    if (leveledUp) {
      await this.characterRepository.save(character);
    }
    return leveledUp;
  }

  /**
   * Compute derived (resource) stats based on primary stats, race bonuses and rank bonuses
   */
  async computeDerivedStats(baseStats, race, rankLevel) {
    const rank = await this.rankService.getRank(rankLevel) || { hpPercent:0, aetherPercent:0 };

    // Get primary stat definitions to dynamically calculate derived stats
    const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
    
    // Apply race bonuses to base stats and get stat values
    const statValues = {};
    let primarySum = 0;
    
    for (const statDef of primaryStats) {
      const baseValue = baseStats[statDef.internalName] || 0;
      const raceBonus = race?.[`${statDef.internalName}Bonus`] || 0;
      const finalValue = baseValue + raceBonus;
      statValues[statDef.internalName] = finalValue;
      primarySum += finalValue;
    }

    // For backward compatibility, map to old stat names if they exist
    const FOC = statValues.foc || 0;
    const CON = statValues.con || 0;
    const RES = statValues.res || 0;
    const INS = statValues.ins || 0;
    const PRE = statValues.pre || 0;
    const FOR = statValues.for || 0;

    // Reactions (based on Instinct and Focus)
    const reactions = ((INS + FOC) / 2) + (INS * 0.165);

    // Speed (using legacy speedBonus for backward compatibility)
    const BSP = race?.speedBonus || 0;
    const speed = ((FOR + CON + RES) / 3) + (FOR * 0.165) + BSP;

    // HP (using legacy healthBonus for backward compatibility)
    const BHP = race?.healthBonus || 0;
    const baseHP = ((RES * 2) + (CON * 3)) + BHP;
    const hp = Math.floor(baseHP * (1 + (rank.hpPercent || 0) / 100));

    // Aether (AE) (using legacy manaBonus for backward compatibility)
    const BAE = race?.manaBonus || 0;
    const baseAE = BAE + Math.sqrt(primarySum) * 5;
    const aether = Math.floor(baseAE * (1 + (rank.aetherPercent || 0) / 100));

    return { reactions: Math.floor(reactions), speed: Math.floor(speed), hp, aether };
  }
}
