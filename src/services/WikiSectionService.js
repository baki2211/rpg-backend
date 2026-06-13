import { AppDataSource } from '../data-source.js';
import { WikiSection } from '../models/wikiSectionModel.js';
import { WikiEntry } from '../models/wikiEntryModel.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';

export class WikiSectionService {
  sectionRepository = AppDataSource.getRepository(WikiSection);
  entryRepository = AppDataSource.getRepository(WikiEntry);

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
   * Ensure a section slug is unique
   * @param {string} baseSlug - Base slug to check
   * @param {number} excludeId - ID to exclude from check (for updates)
   * @returns {Promise<string>} Unique slug
   */
  async ensureUniqueSectionSlug(baseSlug, excludeId = null) {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      let existing;
      if (excludeId) {
        existing = await this.sectionRepository
          .createQueryBuilder('section')
          .where('section.slug = :slug', { slug })
          .andWhere('section.id != :excludeId', { excludeId })
          .getOne();
      } else {
        existing = await this.sectionRepository.findOne({ where: { slug } });
      }

      if (!existing) break;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Get all sections, ordered by position
   * @param {boolean} includeInactive - Include inactive sections
   * @returns {Promise<Array>} Array of sections
   */
  async getAllSections(includeInactive = false) {
    const whereCondition = includeInactive ? {} : { isActive: true };

    return await this.sectionRepository.find({
      where: whereCondition,
      relations: { creator: true, entries: true },
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
      relations: { creator: true, entries: { creator: true } }
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
      relations: { creator: true, entries: { creator: true } }
    });
  }

  /**
   * Create a new section
   * @param {Object} sectionData - Section data
   * @param {number} createdBy - User ID creating the section
   * @returns {Promise<Object>} Created section
   */
  async createSection(sectionData, createdBy) {
    const baseSlug = this.generateSlug(sectionData.name);
    const slug = await this.ensureUniqueSectionSlug(baseSlug);

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
      throw new HttpError(404, 'Section not found');
    }

    if (updateData.name && updateData.name !== section.name) {
      const baseSlug = this.generateSlug(updateData.name);
      updateData.slug = await this.ensureUniqueSectionSlug(baseSlug, id);
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
        throw new HttpError(404, 'Section not found');
      }

      await entryRepo.delete({ sectionId: id });
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

  /**
   * Get navigation structure for public view with hierarchy
   * @returns {Promise<Object>} Navigation structure
   */
  async getPublicNavigation() {
    const sections = await this.sectionRepository.find({
      where: { isActive: true },
      order: { position: 'ASC' }
    });

    const navigationSections = [];

    for (const section of sections) {
      const entries = await this.entryRepository.find({
        where: { sectionId: section.id, isPublished: true },
        select: { id: true, title: true, slug: true, excerpt: true, parentEntryId: true, level: true },
        order: { level: 'ASC', position: 'ASC' }
      });

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

      const hierarchicalEntries = rootEntries.map(id => entryMap.get(id)).filter(Boolean);

      navigationSections.push({
        ...section,
        entryCount: entries.length,
        entries: hierarchicalEntries
      });
    }

    return {
      sections: navigationSections
    };
  }
}
