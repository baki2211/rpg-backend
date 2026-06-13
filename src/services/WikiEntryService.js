import { AppDataSource } from '../data-source.js';
import { WikiSection } from '../models/wikiSectionModel.js';
import { WikiEntry } from '../models/wikiEntryModel.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';

export class WikiEntryService {
  entryRepository = AppDataSource.getRepository(WikiEntry);
  sectionRepository = AppDataSource.getRepository(WikiSection);

  /**
   * Generate a URL-safe slug from a string
   * @param {string} text - Text to convert to slug
   * @returns {string} URL-safe slug
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Ensure an entry slug is unique within its section
   * @param {string} baseSlug - Base slug to check
   * @param {number} sectionId - Section ID
   * @param {number} excludeId - ID to exclude from check (for updates)
   * @returns {Promise<string>} Unique slug
   */
  async ensureUniqueEntrySlug(baseSlug, sectionId, excludeId = null) {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let existing;
      if (excludeId) {
        existing = await this.entryRepository
          .createQueryBuilder('entry')
          .where('entry.slug = :slug', { slug })
          .andWhere('entry.sectionId = :sectionId', { sectionId })
          .andWhere('entry.id != :excludeId', { excludeId })
          .getOne();
      } else {
        existing = await this.entryRepository.findOne({ where: { slug, sectionId } });
      }

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Generate excerpt from content
   * @param {string} content - Full content
   * @param {number} length - Maximum excerpt length
   * @returns {string} Generated excerpt
   */
  generateExcerpt(content, length = 200) {
    const plainText = content
      .replace(/[#*_`~\[\]()]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (plainText.length <= length) {
      return plainText;
    }

    const truncated = plainText.substring(0, length);
    const lastSpace = truncated.lastIndexOf(' ');

    return lastSpace > 0
      ? truncated.substring(0, lastSpace) + '...'
      : truncated + '...';
  }

  /**
   * Get all entries across all sections
   * @param {boolean} includeUnpublished - Include unpublished entries
   * @returns {Promise<Array>} Array of entries
   */
  async getAllEntries(includeUnpublished = false) {
    const whereCondition = includeUnpublished ? {} : { isPublished: true };

    return await this.entryRepository.find({
      where: whereCondition,
      relations: { creator: true, section: true },
      order: {
        section: { position: 'ASC' },
        position: 'ASC',
        title: 'ASC'
      }
    });
  }

  /**
   * Get all entries for a section
   * @param {number} sectionId - Section ID
   * @param {boolean} includeUnpublished - Include unpublished entries
   * @returns {Promise<Array>} Array of entries
   */
  async getEntriesBySection(sectionId, includeUnpublished = false) {
    const whereCondition = { sectionId };
    if (!includeUnpublished) {
      whereCondition.isPublished = true;
    }

    return await this.entryRepository.find({
      where: whereCondition,
      relations: { creator: true, section: true, parentEntry: true, childEntries: true },
      order: { level: 'ASC', position: 'ASC', title: 'ASC' }
    });
  }

  /**
   * Get entries in hierarchical structure
   * @param {number} sectionId - Section ID
   * @param {boolean} includeUnpublished - Include unpublished entries
   * @returns {Promise<Array>} Hierarchical entries
   */
  async getEntriesHierarchical(sectionId, includeUnpublished = false) {
    const entries = await this.getEntriesBySection(sectionId, includeUnpublished);

    const entryMap = new Map();
    const rootEntries = [];

    entries.forEach(entry => {
      entryMap.set(entry.id, { ...entry, children: [] });
      if (!entry.parentEntryId) {
        rootEntries.push(entry.id);
      }
    });

    entries.forEach(entry => {
      if (entry.parentEntryId && entryMap.has(entry.parentEntryId)) {
        entryMap.get(entry.parentEntryId).children.push(entryMap.get(entry.id));
      }
    });

    return rootEntries.map(id => entryMap.get(id)).filter(Boolean);
  }

  /**
   * Get entry by ID
   * @param {number} id - Entry ID
   * @returns {Promise<Object|null>} Entry or null
   */
  async getEntryById(id) {
    return await this.entryRepository.findOne({
      where: { id },
      relations: { creator: true, section: true }
    });
  }

  /**
   * Get entry by section and slug
   * @param {number} sectionId - Section ID
   * @param {string} slug - Entry slug
   * @param {boolean} incrementView - Whether to increment view count
   * @returns {Promise<Object|null>} Entry or null
   */
  async getEntryBySlug(sectionId, slug, incrementView = false) {
    const entry = await this.entryRepository.findOne({
      where: { sectionId, slug, isPublished: true },
      relations: { creator: true, section: true }
    });

    if (entry && incrementView) {
      await this.entryRepository.update(entry.id, {
        viewCount: entry.viewCount + 1
      });
      entry.viewCount += 1;
    }

    return entry;
  }

  /**
   * Create a new entry
   * @param {Object} entryData - Entry data
   * @param {number} createdBy - User ID creating the entry
   * @returns {Promise<Object>} Created entry
   */
  async createEntry(entryData, createdBy) {
    const section = await this.sectionRepository.findOne({ where: { id: entryData.sectionId } });
    if (!section) {
      throw new HttpError(404, 'Section not found');
    }

    let level = 1;
    if (entryData.parentEntryId) {
      const parentEntry = await this.getEntryById(entryData.parentEntryId);
      if (!parentEntry) {
        throw new HttpError(404, 'Parent entry not found');
      }
      if (parentEntry.sectionId !== entryData.sectionId) {
        throw new HttpError(400, 'Parent entry must be in the same section');
      }
      level = parentEntry.level + 1;
      if (level > 4) {
        throw new HttpError(400, 'Maximum nesting level (4) exceeded');
      }
    }

    const baseSlug = this.generateSlug(entryData.title);
    const slug = await this.ensureUniqueEntrySlug(baseSlug, entryData.sectionId);

    if (!entryData.excerpt && entryData.content) {
      entryData.excerpt = this.generateExcerpt(entryData.content);
    }

    if (!entryData.position) {
      const whereCondition = {
        sectionId: entryData.sectionId,
        level: level
      };
      if (entryData.parentEntryId) {
        whereCondition.parentEntryId = entryData.parentEntryId;
      } else {
        whereCondition.parentEntryId = null;
      }

      const lastEntry = await this.entryRepository.findOne({
        where: whereCondition,
        order: { position: 'DESC' }
      });
      entryData.position = (lastEntry?.position || 0) + 1;
    }

    const entry = this.entryRepository.create({
      ...entryData,
      slug,
      level,
      createdBy
    });

    const savedEntry = await this.entryRepository.save(entry);

    logger.info(`Wiki entry created: ${savedEntry.title} in ${section.name} - Level ${level}`, {
      entryId: savedEntry.id,
      sectionId: entryData.sectionId,
      parentEntryId: entryData.parentEntryId,
      level,
      createdBy
    });

    return this.getEntryById(savedEntry.id);
  }

  /**
   * Update an entry
   * @param {number} id - Entry ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated entry
   */
  async updateEntry(id, updateData) {
    return await AppDataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(WikiEntry);

      const entry = await entryRepo.findOne({
        where: { id },
        relations: { childEntries: true }
      });

      if (!entry) {
        throw new HttpError(404, 'Entry not found');
      }

      let newLevel = entry.level;
      let levelChanged = false;

      if (updateData.parentEntryId !== undefined) {
        if (updateData.parentEntryId !== null && updateData.parentEntryId !== entry.parentEntryId) {
          const newParent = await entryRepo.findOne({ where: { id: updateData.parentEntryId } });

          if (!newParent) {
            throw new HttpError(404, 'Parent entry not found');
          }

          if (newParent.sectionId !== entry.sectionId) {
            throw new HttpError(400, 'Parent entry must be in the same section');
          }

          if (await this.wouldCreateCircularReference(id, updateData.parentEntryId, manager)) {
            throw new HttpError(400, 'Cannot set parent: would create circular reference');
          }

          newLevel = newParent.level + 1;

          if (newLevel > 4) {
            throw new HttpError(400, 'Maximum nesting level (4) exceeded');
          }

          levelChanged = newLevel !== entry.level;
        } else if (updateData.parentEntryId === null && entry.parentEntryId !== null) {
          newLevel = 1;
          levelChanged = newLevel !== entry.level;
        }
      }

      if (updateData.title && updateData.title !== entry.title) {
        const baseSlug = this.generateSlug(updateData.title);
        updateData.slug = await this.ensureUniqueEntrySlug(baseSlug, entry.sectionId, id);
      }

      if (updateData.content && !updateData.excerpt) {
        updateData.excerpt = this.generateExcerpt(updateData.content);
      }

      if (levelChanged) {
        updateData.level = newLevel;
      }

      await entryRepo.update(id, updateData);

      if (levelChanged) {
        await this.updateDescendantLevels(id, newLevel, manager);
      }

      logger.info(`Wiki entry updated: ${entry.title}`, {
        entryId: id,
        changes: Object.keys(updateData),
        levelChanged,
        newLevel: levelChanged ? newLevel : entry.level
      });

      return this.getEntryById(id);
    });
  }

  /**
   * Check if changing parent would create a circular reference
   * @param {number} entryId - Entry being moved
   * @param {number} newParentId - Proposed new parent
   * @param {Object} manager - Transaction manager
   * @returns {Promise<boolean>} True if would create circular reference
   */
  async wouldCreateCircularReference(entryId, newParentId, manager) {
    const entryRepo = manager.getRepository(WikiEntry);

    let currentParentId = newParentId;

    while (currentParentId) {
      if (currentParentId === entryId) {
        return true;
      }

      const parent = await entryRepo.findOne({
        where: { id: currentParentId },
        select: { parentEntryId: true }
      });

      if (!parent) break;
      currentParentId = parent.parentEntryId;
    }

    return false;
  }

  /**
   * Recursively update levels of all descendant entries
   * @param {number} parentId - Parent entry ID
   * @param {number} parentLevel - Parent's new level
   * @param {Object} manager - Transaction manager
   */
  async updateDescendantLevels(parentId, parentLevel, manager) {
    const entryRepo = manager.getRepository(WikiEntry);

    const children = await entryRepo.find({
      where: { parentEntryId: parentId },
      select: { id: true, level: true }
    });

    for (const child of children) {
      const newChildLevel = parentLevel + 1;

      if (newChildLevel > 4) {
        throw new HttpError(400, `Update would exceed maximum nesting level for entry ${child.id}`);
      }

      await entryRepo.update(child.id, { level: newChildLevel });

      await this.updateDescendantLevels(child.id, newChildLevel, manager);
    }
  }

  /**
   * Delete an entry
   * @param {number} id - Entry ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteEntry(id) {
    const entry = await this.getEntryById(id);
    if (!entry) {
      throw new HttpError(404, 'Entry not found');
    }

    await this.entryRepository.delete(id);

    logger.info(`Wiki entry deleted: ${entry.title}`, {
      entryId: id,
      sectionId: entry.sectionId
    });

    return true;
  }

  /**
   * Reorder entries within a section
   * @param {number} sectionId - Section ID
   * @param {Array} entryOrder - Array of {id, position} objects
   * @returns {Promise<Array>} Updated entries
   */
  async reorderEntries(sectionId, entryOrder) {
    return await AppDataSource.transaction(async (manager) => {
      const entryRepo = manager.getRepository(WikiEntry);

      for (const { id, position } of entryOrder) {
        await entryRepo.update(id, { position });
      }

      logger.info(`Wiki entries reordered in section ${sectionId}`, {
        entryCount: entryOrder.length
      });

      return this.getEntriesBySection(sectionId, true);
    });
  }
}
