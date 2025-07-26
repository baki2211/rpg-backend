import { AppDataSource } from '../data-source.js';
import { Race } from '../models/raceModel.js';
import { Skill } from '../models/skillModel.js';
import { SkillBranch } from '../models/skillBranchModel.js';
import { SkillType } from '../models/skillTypeModel.js';
import { StatDefinition } from '../models/statDefinitionModel.js';
import { Rank } from '../models/rankModel.js';
import { logger } from './logger.js';

class StaticDataCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
    this.isInitialized = false;
  }

  /**
   * Generate cache key
   */
  getCacheKey(entity, query = {}) {
    const queryStr = JSON.stringify(query);
    return `${entity}:${queryStr}`;
  }

  /**
   * Check if cache entry is expired
   */
  isExpired(key) {
    const expiry = this.cacheExpiry.get(key);
    return !expiry || Date.now() > expiry;
  }

  /**
   * Set cache entry with TTL
   */
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + ttl);
  }

  /**
   * Get cache entry if not expired
   */
  get(key) {
    if (this.isExpired(key)) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.cacheExpiry.clear();
    logger.info('Static data cache cleared');
  }

  /**
   * Clear cache for specific entity
   */
  clearEntity(entity) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${entity}:`)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
    logger.info(`Cache cleared for entity: ${entity}`);
  }

  /**
   * Get all races with caching
   */
  async getRaces() {
    const key = this.getCacheKey('Race', { all: true });
    let races = this.get(key);
    
    if (!races) {
      const raceRepo = AppDataSource.getRepository(Race);
      races = await raceRepo.find();
      this.set(key, races, 10 * 60 * 1000); // 10 minutes for races
      logger.debug('Races loaded from database and cached');
    }
    
    return races;
  }

  /**
   * Get race by id with caching
   */
  async getRaceById(id) {
    const key = this.getCacheKey('Race', { id });
    let race = this.get(key);
    
    if (!race) {
      const raceRepo = AppDataSource.getRepository(Race);
      race = await raceRepo.findOne({ where: { id } });
      if (race) {
        this.set(key, race, 10 * 60 * 1000);
        logger.debug(`Race ${id} loaded from database and cached`);
      }
    }
    
    return race;
  }

  /**
   * Get all skills with relations, cached
   */
  async getSkills(includeRelations = false) {
    const key = this.getCacheKey('Skill', { all: true, relations: includeRelations });
    let skills = this.get(key);
    
    if (!skills) {
      const skillRepo = AppDataSource.getRepository(Skill);
      const relations = includeRelations ? ['branch', 'type'] : [];
      skills = await skillRepo.find({ relations });
      this.set(key, skills, 5 * 60 * 1000); // 5 minutes for skills
      logger.debug('Skills loaded from database and cached');
    }
    
    return skills;
  }

  /**
   * Get skill by id with relations, cached
   */
  async getSkillById(id, includeRelations = false) {
    const key = this.getCacheKey('Skill', { id, relations: includeRelations });
    let skill = this.get(key);
    
    if (!skill) {
      const skillRepo = AppDataSource.getRepository(Skill);
      const relations = includeRelations ? ['branch', 'type'] : [];
      skill = await skillRepo.findOne({ where: { id }, relations });
      if (skill) {
        this.set(key, skill, 5 * 60 * 1000);
        logger.debug(`Skill ${id} loaded from database and cached`);
      }
    }
    
    return skill;
  }

  /**
   * Get all skill branches with caching
   */
  async getSkillBranches() {
    const key = this.getCacheKey('SkillBranch', { all: true });
    let branches = this.get(key);
    
    if (!branches) {
      const branchRepo = AppDataSource.getRepository(SkillBranch);
      branches = await branchRepo.find();
      this.set(key, branches, 10 * 60 * 1000); // 10 minutes for branches
      logger.debug('Skill branches loaded from database and cached');
    }
    
    return branches;
  }

  /**
   * Get all skill types with caching
   */
  async getSkillTypes() {
    const key = this.getCacheKey('SkillType', { all: true });
    let types = this.get(key);
    
    if (!types) {
      const typeRepo = AppDataSource.getRepository(SkillType);
      types = await typeRepo.find();
      this.set(key, types, 15 * 60 * 1000); // 15 minutes for types (very static)
      logger.debug('Skill types loaded from database and cached');
    }
    
    return types;
  }

  /**
   * Get stat definitions with caching
   */
  async getStatDefinitions(category = null, isActive = null) {
    const key = this.getCacheKey('StatDefinition', { category, isActive });
    let stats = this.get(key);
    
    if (!stats) {
      const statRepo = AppDataSource.getRepository(StatDefinition);
      const where = {};
      if (category) where.category = category;
      if (isActive !== null) where.isActive = isActive;
      
      stats = await statRepo.find({ where });
      this.set(key, stats, 15 * 60 * 1000); // 15 minutes for stat definitions
      logger.debug('Stat definitions loaded from database and cached');
    }
    
    return stats;
  }

  /**
   * Get all ranks with caching
   */
  async getRanks() {
    const key = this.getCacheKey('Rank', { all: true });
    let ranks = this.get(key);
    
    if (!ranks) {
      const rankRepo = AppDataSource.getRepository(Rank);
      ranks = await rankRepo.find({ order: { requiredExperience: 'ASC' } });
      this.set(key, ranks, 15 * 60 * 1000); // 15 minutes for ranks
      logger.debug('Ranks loaded from database and cached');
    }
    
    return ranks;
  }

  /**
   * Preload all static data into cache
   */
  async preloadCache() {
    if (this.isInitialized) return;
    
    try {
      logger.info('Preloading static data cache...');
      
      const startTime = Date.now();
      
      // Preload in parallel
      await Promise.all([
        this.getRaces(),
        this.getSkills(true), // Include relations for common use case
        this.getSkillBranches(),
        this.getSkillTypes(),
        this.getStatDefinitions(),
        this.getRanks()
      ]);
      
      const loadTime = Date.now() - startTime;
      this.isInitialized = true;
      
      logger.info(`Static data cache preloaded in ${loadTime}ms`, {
        cacheSize: this.cache.size,
        entities: ['Race', 'Skill', 'SkillBranch', 'SkillType', 'StatDefinition', 'Rank']
      });
    } catch (error) {
      logger.error('Failed to preload static data cache:', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      size: this.cache.size,
      expiryEntries: this.cacheExpiry.size,
      isInitialized: this.isInitialized
    };
    
    // Count entries by entity type
    const entityCounts = {};
    for (const key of this.cache.keys()) {
      const entity = key.split(':')[0];
      entityCounts[entity] = (entityCounts[entity] || 0) + 1;
    }
    stats.entities = entityCounts;
    
    return stats;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    let removedCount = 0;
    for (const key of this.cache.keys()) {
      if (this.isExpired(key)) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} expired cache entries`);
    }
    
    return removedCount;
  }
}

// Create singleton instance
const staticDataCache = new StaticDataCache();

export default staticDataCache;