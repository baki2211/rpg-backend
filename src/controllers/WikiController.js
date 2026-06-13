import { WikiSectionService } from '../services/WikiSectionService.js';
import { WikiEntryService } from '../services/WikiEntryService.js';
import { WikiSearchService } from '../services/WikiSearchService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const sectionService = new WikiSectionService();
const entryService = new WikiEntryService();
const searchService = new WikiSearchService();

export class WikiController {
  // ============ ADMIN SECTION ENDPOINTS ============

  static adminGetSections = asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const sections = await sectionService.getAllSections(includeInactive);
    res.json(sections);
  });

  static adminCreateSection = asyncHandler(async (req, res) => {
    const { name, description, position, isActive } = req.body;
    if (!name) throw new HttpError(400, 'Section name is required');

    const section = await sectionService.createSection(
      {
        name,
        description,
        position,
        isActive: isActive !== undefined ? isActive : true
      },
      req.user.id
    );
    res.status(201).json(section);
  });

  static adminUpdateSection = asyncHandler(async (req, res) => {
    const section = await sectionService.updateSection(parseInt(req.params.id), req.body);
    res.json(section);
  });

  static adminDeleteSection = asyncHandler(async (req, res) => {
    await sectionService.deleteSection(parseInt(req.params.id));
    res.status(204).end();
  });

  static adminReorderSections = asyncHandler(async (req, res) => {
    const { sectionOrder } = req.body;
    if (!Array.isArray(sectionOrder)) {
      throw new HttpError(400, 'Section order must be an array');
    }
    const sections = await sectionService.reorderSections(sectionOrder);
    res.json(sections);
  });

  // ============ ADMIN ENTRY ENDPOINTS ============

  static adminGetEntries = asyncHandler(async (req, res) => {
    const includeUnpublished = req.query.includeUnpublished === 'true';
    const entries = await entryService.getEntriesBySection(parseInt(req.params.sectionId), includeUnpublished);
    res.json(entries);
  });

  static adminGetEntriesHierarchical = asyncHandler(async (req, res) => {
    const includeUnpublished = req.query.includeUnpublished === 'true';
    const entries = await entryService.getEntriesHierarchical(parseInt(req.params.sectionId), includeUnpublished);
    res.json(entries);
  });

  static adminGetAllEntries = asyncHandler(async (req, res) => {
    const includeUnpublished = req.query.includeUnpublished === 'true';
    const entries = await entryService.getAllEntries(includeUnpublished);
    res.json(entries);
  });

  static adminGetEntry = asyncHandler(async (req, res) => {
    const entry = await entryService.getEntryById(parseInt(req.params.id));
    if (!entry) throw new HttpError(404, 'Entry not found');
    res.json(entry);
  });

  static adminCreateEntry = asyncHandler(async (req, res) => {
    const { sectionId, title, content, excerpt, tags, isPublished, position, parentEntryId } = req.body;
    if (!sectionId || !title || !content) {
      throw new HttpError(400, 'Section ID, title, and content are required');
    }

    const entry = await entryService.createEntry(
      {
        sectionId: parseInt(sectionId),
        title,
        content,
        excerpt,
        tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
        isPublished: isPublished !== undefined ? isPublished : true,
        position,
        parentEntryId: parentEntryId ? parseInt(parentEntryId) : null
      },
      req.user.id
    );
    res.status(201).json(entry);
  });

  static adminUpdateEntry = asyncHandler(async (req, res) => {
    const updateData = { ...req.body };

    if (updateData.tags && !Array.isArray(updateData.tags)) {
      updateData.tags = [updateData.tags];
    }

    if (updateData.parentEntryId === '') {
      updateData.parentEntryId = null;
    } else if (updateData.parentEntryId && typeof updateData.parentEntryId === 'string') {
      updateData.parentEntryId = parseInt(updateData.parentEntryId);
    }

    const entry = await entryService.updateEntry(parseInt(req.params.id), updateData);
    res.json(entry);
  });

  static adminDeleteEntry = asyncHandler(async (req, res) => {
    await entryService.deleteEntry(parseInt(req.params.id));
    res.status(204).end();
  });

  static adminReorderEntries = asyncHandler(async (req, res) => {
    const { entryOrder } = req.body;
    if (!Array.isArray(entryOrder)) {
      throw new HttpError(400, 'Entry order must be an array');
    }
    const entries = await entryService.reorderEntries(parseInt(req.params.sectionId), entryOrder);
    res.json(entries);
  });

  // ============ ADMIN UTILITY ENDPOINTS ============

  static adminGetWikiStats = asyncHandler(async (req, res) => {
    const stats = await searchService.getWikiStats();
    res.json(stats);
  });

  static adminGetAllTags = asyncHandler(async (req, res) => {
    const tags = await searchService.getAllTags();
    res.json(tags);
  });

  // ============ PUBLIC ENDPOINTS ============

  static getPublicNavigation = asyncHandler(async (req, res) => {
    const navigation = await sectionService.getPublicNavigation();
    res.json(navigation);
  });

  static getPublicSection = asyncHandler(async (req, res) => {
    const section = await sectionService.getSectionBySlug(req.params.slug);
    if (!section) throw new HttpError(404, 'Section not found');

    res.json({
      ...section,
      entries: section.entries.filter(entry => entry.isPublished)
    });
  });

  static getPublicEntry = asyncHandler(async (req, res) => {
    const { sectionSlug, entrySlug } = req.params;

    const section = await sectionService.getSectionBySlug(sectionSlug);
    if (!section) throw new HttpError(404, 'Section not found');

    const entry = await entryService.getEntryBySlug(section.id, entrySlug, true);
    if (!entry) throw new HttpError(404, 'Entry not found');

    res.json(entry);
  });

  static searchPublicEntries = asyncHandler(async (req, res) => {
    const { q: query, section: sectionId } = req.query;
    if (!query || query.trim().length < 2) {
      throw new HttpError(400, 'Search query must be at least 2 characters long');
    }

    const results = await searchService.searchEntries(
      query.trim(),
      sectionId ? parseInt(sectionId) : null
    );
    res.json(results);
  });

  static getPublicEntriesByTag = asyncHandler(async (req, res) => {
    const { tag } = req.params;
    if (!tag) throw new HttpError(400, 'Tag is required');

    const entries = await searchService.getEntriesByTag(tag);
    res.json(entries);
  });

  static getPublicTags = asyncHandler(async (req, res) => {
    const tags = await searchService.getAllTags();
    res.json(tags);
  });
}
