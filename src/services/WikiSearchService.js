import { AppDataSource } from '../data-source.js';
import { WikiSection } from '../models/wikiSectionModel.js';
import { WikiEntry } from '../models/wikiEntryModel.js';

export class WikiSearchService {
  sectionRepository = AppDataSource.getRepository(WikiSection);
  entryRepository = AppDataSource.getRepository(WikiEntry);

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
      select: { tags: true }
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
    const [
      totalSections,
      activeSections,
      totalEntries,
      publishedEntries,
      totalViews,
      popularTags,
      levelDistribution
    ] = await Promise.all([
      this.sectionRepository.count(),
      this.sectionRepository.count({ where: { isActive: true } }),
      this.entryRepository.count(),
      this.entryRepository.count({ where: { isPublished: true } }),
      this.entryRepository
        .createQueryBuilder('entry')
        .select('SUM(entry.viewCount)', 'totalViews')
        .getRawOne(),
      this.getPopularTags(),
      this.getLevelDistribution()
    ]);

    return {
      totalSections,
      activeSections,
      totalEntries,
      publishedEntries,
      totalViews: parseInt(totalViews.totalViews) || 0,
      popularTags,
      levelDistribution
    };
  }

  /**
   * Get popular tags with counts
   * @returns {Promise<Array>} Popular tags
   */
  async getPopularTags() {
    const entries = await this.entryRepository.find({
      where: { isPublished: true },
      select: { tags: true }
    });

    const tagCounts = new Map();
    entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  /**
   * Get distribution of entries by level
   * @returns {Promise<Array>} Level distribution
   */
  async getLevelDistribution() {
    const distribution = await this.entryRepository
      .createQueryBuilder('entry')
      .select('entry.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('entry.level')
      .orderBy('entry.level', 'ASC')
      .getRawMany();

    return distribution.map(item => ({
      level: parseInt(item.level),
      count: parseInt(item.count)
    }));
  }
}
