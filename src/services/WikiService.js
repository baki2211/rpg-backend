import { AppDataSource } from '../data-source.js';
import { WikiSection } from '../models/wikiSectionModel.js';
import { WikiEntry } from '../models/wikiEntryModel.js';
import { User } from '../models/userModel.js';
import { logger } from '../utils/logger.js';

export class WikiService {
  constructor() {
    this.sectionRepository = AppDataSource.getRepository(WikiSection);
    this.entryRepository = AppDataSource.getRepository(WikiEntry);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Generate a URL-safe slug from a string
   * @param {string} text - Text to convert to slug
   * @returns {string} URL-safe slug
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Ensure slug is unique within its scope
   * @param {string} baseSlug - Base slug to check
   * @param {string} type - 'section' or 'entry'
   * @param {number} sectionId - Section ID (for entries only)
   * @param {number} excludeId - ID to exclude from check (for updates)
   * @returns {Promise<string>} Unique slug
   */
  async ensureUniqueSlug(baseSlug, type, sectionId = null, excludeId = null) {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let existingItem;
      
      if (type === 'section') {
        if (excludeId) {
          existingItem = await this.sectionRepository
            .createQueryBuilder('section')
            .where('section.slug = :slug', { slug })
            .andWhere('section.id != :excludeId', { excludeId })
            .getOne();
        } else {
          existingItem = await this.sectionRepository.findOne({ where: { slug } });
        }
      } else {
        if (excludeId) {
          existingItem = await this.entryRepository
            .createQueryBuilder('entry')
            .where('entry.slug = :slug', { slug })
            .andWhere('entry.sectionId = :sectionId', { sectionId })
            .andWhere('entry.id != :excludeId', { excludeId })
            .getOne();
        } else {
          existingItem = await this.entryRepository.findOne({ where: { slug, sectionId } });
        }
      }

      if (!existingItem) break;
      
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  // ============ SECTION METHODS ============

  /**
   * Get all sections, ordered by position
   * @param {boolean} includeInactive - Include inactive sections
   * @returns {Promise<Array>} Array of sections
   */
  async getAllSections(includeInactive = false) {
    const whereCondition = includeInactive ? {} : { isActive: true };
    
    return await this.sectionRepository.find({
      where: whereCondition,
      relations: ['creator', 'entries'],
      order: { position: 'ASC', name: 'ASC' }
    });
  }

  /**
   * Get section by ID
   * @param {number} id - Section ID
   * @returns {Promise<Object|null>} Section or null
   */
  async getSectionById(id) {
    return await this.sectionRepository.findOne({
      where: { id },
      relations: ['creator', 'entries', 'entries.creator']
    });
  }

  /**
   * Get section by slug
   * @param {string} slug - Section slug
   * @returns {Promise<Object|null>} Section or null
   */
  async getSectionBySlug(slug) {
    return await this.sectionRepository.findOne({
      where: { slug, isActive: true },
      relations: ['creator', 'entries', 'entries.creator']
    });
  }

  /**
   * Create a new section
   * @param {Object} sectionData - Section data
   * @param {number} createdBy - User ID creating the section
   * @returns {Promise<Object>} Created section
   */
  async createSection(sectionData, createdBy) {
    // Generate slug
    const baseSlug = this.generateSlug(sectionData.name);
    const slug = await this.ensureUniqueSlug(baseSlug, 'section');

    // Get next position if not provided
    if (!sectionData.position) {
      const lastSection = await this.sectionRepository
        .createQueryBuilder('section')
        .orderBy('section.position', 'DESC')
        .getOne();
      sectionData.position = (lastSection?.position || 0) + 1;
    }

    const section = this.sectionRepository.create({
      ...sectionData,
      slug,
      createdBy
    });

    const savedSection = await this.sectionRepository.save(section);
    
    logger.info(`Wiki section created: ${savedSection.name} (${savedSection.slug})`, {
      sectionId: savedSection.id,
      createdBy
    });

    return this.getSectionById(savedSection.id);
  }

  /**
   * Update a section
   * @param {number} id - Section ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated section
   */
  async updateSection(id, updateData) {
    const section = await this.getSectionById(id);
    if (!section) {
      throw new Error('Section not found');
    }

    // Generate new slug if name changed
    if (updateData.name && updateData.name !== section.name) {
      const baseSlug = this.generateSlug(updateData.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, 'section', null, id);
    }

    await this.sectionRepository.update(id, updateData);
    
    logger.info(`Wiki section updated: ${section.name}`, {
      sectionId: id,
      changes: Object.keys(updateData)
    });

    return this.getSectionById(id);
  }

  /**
   * Delete a section and all its entries
   * @param {number} id - Section ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSection(id) {
    return await AppDataSource.transaction(async (manager) => {
      const sectionRepo = manager.getRepository(WikiSection);
      const entryRepo = manager.getRepository(WikiEntry);

      const section = await sectionRepo.findOne({ where: { id } });
      if (!section) {
        throw new Error('Section not found');
      }

      // Delete all entries in this section
      await entryRepo.delete({ sectionId: id });
      
      // Delete the section
      await sectionRepo.delete(id);

      logger.info(`Wiki section deleted: ${section.name}`, {
        sectionId: id
      });

      return true;
    });
  }

  /**
   * Reorder sections
   * @param {Array} sectionOrder - Array of {id, position} objects
   * @returns {Promise<Array>} Updated sections
   */
  async reorderSections(sectionOrder) {
    return await AppDataSource.transaction(async (manager) => {
      const sectionRepo = manager.getRepository(WikiSection);
      
      for (const { id, position } of sectionOrder) {
        await sectionRepo.update(id, { position });
      }

      logger.info('Wiki sections reordered', {
        sectionCount: sectionOrder.length
      });

      return this.getAllSections();
    });
  }

  // ============ ENTRY METHODS ============

  /**
   * Get all entries across all sections
   * @param {boolean} includeUnpublished - Include unpublished entries
   * @returns {Promise<Array>} Array of entries
   */
  async getAllEntries(includeUnpublished = false) {
    const whereCondition = includeUnpublished ? {} : { isPublished: true };
    
    return await this.entryRepository.find({
      where: whereCondition,
      relations: ['creator', 'section'],
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
      relations: ['creator', 'section'],
      order: { position: 'ASC', title: 'ASC' }
    });
  }

  /**
   * Get entry by ID
   * @param {number} id - Entry ID
   * @returns {Promise<Object|null>} Entry or null
   */
  async getEntryById(id) {
    return await this.entryRepository.findOne({
      where: { id },
      relations: ['creator', 'section']
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
      relations: ['creator', 'section']
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
    // Verify section exists
    const section = await this.getSectionById(entryData.sectionId);
    if (!section) {
      throw new Error('Section not found');
    }

    // Generate slug
    const baseSlug = this.generateSlug(entryData.title);
    const slug = await this.ensureUniqueSlug(baseSlug, 'entry', entryData.sectionId);

    // Generate excerpt if not provided
    if (!entryData.excerpt && entryData.content) {
      entryData.excerpt = this.generateExcerpt(entryData.content);
    }

    // Get next position if not provided
    if (!entryData.position) {
      const lastEntry = await this.entryRepository.findOne({
        where: { sectionId: entryData.sectionId },
        order: { position: 'DESC' }
      });
      entryData.position = (lastEntry?.position || 0) + 1;
    }

    const entry = this.entryRepository.create({
      ...entryData,
      slug,
      createdBy
    });

    const savedEntry = await this.entryRepository.save(entry);
    
    logger.info(`Wiki entry created: ${savedEntry.title} in ${section.name}`, {
      entryId: savedEntry.id,
      sectionId: entryData.sectionId,
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
    const entry = await this.getEntryById(id);
    if (!entry) {
      throw new Error('Entry not found');
    }

    // Generate new slug if title changed
    if (updateData.title && updateData.title !== entry.title) {
      const baseSlug = this.generateSlug(updateData.title);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, 'entry', entry.sectionId, id);
    }

    // Update excerpt if content changed
    if (updateData.content && !updateData.excerpt) {
      updateData.excerpt = this.generateExcerpt(updateData.content);
    }

    await this.entryRepository.update(id, updateData);
    
    logger.info(`Wiki entry updated: ${entry.title}`, {
      entryId: id,
      changes: Object.keys(updateData)
    });

    return this.getEntryById(id);
  }

  /**
   * Delete an entry
   * @param {number} id - Entry ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteEntry(id) {
    const entry = await this.getEntryById(id);
    if (!entry) {
      throw new Error('Entry not found');
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

  // ============ SEARCH AND UTILITY METHODS ============

  /**
   * Search entries by title, content, or tags
   * @param {string} query - Search query
   * @param {number} sectionId - Optional section ID to limit search
   * @returns {Promise<Array>} Search results
   */
  async searchEntries(query, sectionId = null) {
    const queryBuilder = this.entryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.section', 'section')
      .leftJoinAndSelect('entry.creator', 'creator')
      .where('entry.isPublished = :published', { published: true })
      .andWhere('section.isActive = :active', { active: true });

    if (sectionId) {
      queryBuilder.andWhere('entry.sectionId = :sectionId', { sectionId });
    }

    queryBuilder.andWhere(
      '(entry.title LIKE :query OR entry.content LIKE :query OR entry.excerpt LIKE :query OR JSON_SEARCH(entry.tags, "one", :tagQuery) IS NOT NULL)',
      { 
        query: `%${query}%`,
        tagQuery: `%${query}%`
      }
    );

    return await queryBuilder
      .orderBy('entry.title', 'ASC')
      .getMany();
  }

  /**
   * Get entries by tag
   * @param {string} tag - Tag to search for
   * @returns {Promise<Array>} Tagged entries
   */
  async getEntriesByTag(tag) {
    return await this.entryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.section', 'section')
      .leftJoinAndSelect('entry.creator', 'creator')
      .where('entry.isPublished = :published', { published: true })
      .andWhere('section.isActive = :active', { active: true })
      .andWhere('JSON_SEARCH(entry.tags, "one", :tag) IS NOT NULL', { tag })
      .orderBy('entry.title', 'ASC')
      .getMany();
  }

  /**
   * Get all unique tags from published entries
   * @returns {Promise<Array>} Array of unique tags
   */
  async getAllTags() {
    const entries = await this.entryRepository.find({
      where: { isPublished: true },
      select: ['tags']
    });

    const allTags = new Set();
    entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  /**
   * Get wiki statistics
   * @returns {Promise<Object>} Wiki statistics
   */
  async getWikiStats() {
    const [sectionCount, entryCount, publishedCount] = await Promise.all([
      this.sectionRepository.count({ where: { isActive: true } }),
      this.entryRepository.count(),
      this.entryRepository.count({ where: { isPublished: true } })
    ]);

    const totalViews = await this.entryRepository
      .createQueryBuilder('entry')
      .select('SUM(entry.viewCount)', 'totalViews')
      .getRawOne();

    return {
      sections: sectionCount,
      totalEntries: entryCount,
      publishedEntries: publishedCount,
      totalViews: parseInt(totalViews.totalViews) || 0
    };
  }

  /**
   * Generate excerpt from content
   * @param {string} content - Full content
   * @param {number} length - Maximum excerpt length
   * @returns {string} Generated excerpt
   */
  generateExcerpt(content, length = 200) {
    // Remove markdown formatting
    const plainText = content
      .replace(/[#*_`~\[\]()]/g, '') // Remove markdown characters
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    if (plainText.length <= length) {
      return plainText;
    }

    // Find the last complete word within the length limit
    const truncated = plainText.substring(0, length);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 ? 
      truncated.substring(0, lastSpace) + '...' : 
      truncated + '...';
  }

  /**
   * Get navigation structure for public view
   * @returns {Promise<Object>} Navigation structure
   */
  async getPublicNavigation() {
    const sections = await this.sectionRepository.find({
      where: { isActive: true },
      order: { position: 'ASC' }
    });

    const navigation = [];
    
    for (const section of sections) {
      const entries = await this.entryRepository.find({
        where: { sectionId: section.id, isPublished: true },
        select: ['id', 'title', 'slug', 'excerpt'],
        order: { position: 'ASC' }
      });

      navigation.push({
        ...section,
        entryCount: entries.length,
        entries: entries
      });
    }

    return navigation;
  }
} 