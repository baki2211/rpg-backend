import { WikiService } from '../services/WikiService.js';
import { logger } from '../utils/logger.js';

const wikiService = new WikiService();

// ============ ADMIN SECTION ENDPOINTS ============

export const adminGetSections = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const sections = await wikiService.getAllSections(includeInactive);
    
    res.json({
      success: true,
      data: sections,
      meta: {
        total: sections.length
      }
    });
  } catch (error) {
    logger.error('Error fetching admin sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
      error: error.message
    });
  }
};

export const adminCreateSection = async (req, res) => {
  try {
    const { name, description, position, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Section name is required'
      });
    }

    const sectionData = {
      name,
      description,
      position,
      isActive: isActive !== undefined ? isActive : true
    };

    const section = await wikiService.createSection(sectionData, req.user.id);
    
    res.status(201).json({
      success: true,
      data: section,
      message: 'Section created successfully'
    });
  } catch (error) {
    logger.error('Error creating section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create section',
      error: error.message
    });
  }
};

export const adminUpdateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const section = await wikiService.updateSection(parseInt(id), updateData);
    
    res.json({
      success: true,
      data: section,
      message: 'Section updated successfully'
    });
  } catch (error) {
    logger.error('Error updating section:', error);
    
    if (error.message === 'Section not found') {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update section',
      error: error.message
    });
  }
};

export const adminDeleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    
    await wikiService.deleteSection(parseInt(id));
    
    res.json({
      success: true,
      message: 'Section and all its entries deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting section:', error);
    
    if (error.message === 'Section not found') {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete section',
      error: error.message
    });
  }
};

export const adminReorderSections = async (req, res) => {
  try {
    const { sectionOrder } = req.body;
    
    if (!Array.isArray(sectionOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Section order must be an array'
      });
    }

    const sections = await wikiService.reorderSections(sectionOrder);
    
    res.json({
      success: true,
      data: sections,
      message: 'Sections reordered successfully'
    });
  } catch (error) {
    logger.error('Error reordering sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder sections',
      error: error.message
    });
  }
};

// ============ ADMIN ENTRY ENDPOINTS ============

export const adminGetEntries = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const includeUnpublished = req.query.includeUnpublished === 'true';
    
    const entries = await wikiService.getEntriesBySection(parseInt(sectionId), includeUnpublished);
    
    res.json({
      success: true,
      data: entries,
      meta: {
        total: entries.length,
        sectionId: parseInt(sectionId)
      }
    });
  } catch (error) {
    logger.error('Error fetching admin entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entries',
      error: error.message
    });
  }
};

export const adminGetEntriesHierarchical = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const includeUnpublished = req.query.includeUnpublished === 'true';
    
    const entries = await wikiService.getEntriesHierarchical(parseInt(sectionId), includeUnpublished);
    
    res.json({
      success: true,
      data: entries,
      meta: {
        total: entries.length,
        sectionId: parseInt(sectionId)
      }
    });
  } catch (error) {
    logger.error('Error fetching hierarchical entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hierarchical entries',
      error: error.message
    });
  }
};

export const adminGetAllEntries = async (req, res) => {
  try {
    const includeUnpublished = req.query.includeUnpublished === 'true';
    
    const entries = await wikiService.getAllEntries(includeUnpublished);
    
    res.json({
      success: true,
      data: entries,
      meta: {
        total: entries.length
      }
    });
  } catch (error) {
    logger.error('Error fetching all admin entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entries',
      error: error.message
    });
  }
};

export const adminGetEntry = async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await wikiService.getEntryById(parseInt(id));
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }
    
    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    logger.error('Error fetching admin entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entry',
      error: error.message
    });
  }
};

export const adminCreateEntry = async (req, res) => {
  try {
    const { sectionId, title, content, excerpt, tags, isPublished, position, parentEntryId } = req.body;
    
    if (!sectionId || !title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Section ID, title, and content are required'
      });
    }

    const entryData = {
      sectionId: parseInt(sectionId),
      title,
      content,
      excerpt,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
      isPublished: isPublished !== undefined ? isPublished : true,
      position,
      parentEntryId: parentEntryId ? parseInt(parentEntryId) : null
    };

    const entry = await wikiService.createEntry(entryData, req.user.id);
    
    res.status(201).json({
      success: true,
      data: entry,
      message: 'Entry created successfully'
    });
  } catch (error) {
    logger.error('Error creating entry:', error);
    
    if (error.message === 'Section not found') {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    if (error.message === 'Parent entry not found') {
      return res.status(404).json({
        success: false,
        message: 'Parent entry not found'
      });
    }

    if (error.message === 'Maximum nesting level (4) exceeded') {
      return res.status(400).json({
        success: false,
        message: 'Maximum nesting level (4) exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create entry',
      error: error.message
    });
  }
};

export const adminUpdateEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Ensure tags is an array if provided
    if (updateData.tags && !Array.isArray(updateData.tags)) {
      updateData.tags = [updateData.tags];
    }

    // Handle parentEntryId conversion
    if (updateData.parentEntryId === '') {
      updateData.parentEntryId = null;
    } else if (updateData.parentEntryId && typeof updateData.parentEntryId === 'string') {
      updateData.parentEntryId = parseInt(updateData.parentEntryId);
    }

    const entry = await wikiService.updateEntry(parseInt(id), updateData);
    
    res.json({
      success: true,
      data: entry,
      message: 'Entry updated successfully'
    });
  } catch (error) {
    logger.error('Error updating entry:', error);
    
    if (error.message === 'Entry not found') {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }

    if (error.message === 'Parent entry not found') {
      return res.status(404).json({
        success: false,
        message: 'Parent entry not found'
      });
    }

    if (error.message === 'Parent entry must be in the same section') {
      return res.status(400).json({
        success: false,
        message: 'Parent entry must be in the same section'
      });
    }

    if (error.message === 'Cannot set parent: would create circular reference') {
      return res.status(400).json({
        success: false,
        message: 'Cannot set parent: would create circular reference'
      });
    }

    if (error.message === 'Maximum nesting level (4) exceeded' || 
        error.message.includes('Update would exceed maximum nesting level')) {
      return res.status(400).json({
        success: false,
        message: 'Maximum nesting level (4) exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update entry',
      error: error.message
    });
  }
};

export const adminDeleteEntry = async (req, res) => {
  try {
    const { id } = req.params;
    
    await wikiService.deleteEntry(parseInt(id));
    
    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting entry:', error);
    
    if (error.message === 'Entry not found') {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete entry',
      error: error.message
    });
  }
};

export const adminReorderEntries = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { entryOrder } = req.body;
    
    if (!Array.isArray(entryOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Entry order must be an array'
      });
    }

    const entries = await wikiService.reorderEntries(parseInt(sectionId), entryOrder);
    
    res.json({
      success: true,
      data: entries,
      message: 'Entries reordered successfully'
    });
  } catch (error) {
    logger.error('Error reordering entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder entries',
      error: error.message
    });
  }
};

// ============ ADMIN UTILITY ENDPOINTS ============

export const adminGetWikiStats = async (req, res) => {
  try {
    const stats = await wikiService.getWikiStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching wiki stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wiki statistics',
      error: error.message
    });
  }
};

export const adminGetAllTags = async (req, res) => {
  try {
    const tags = await wikiService.getAllTags();
    
    res.json({
      success: true,
      data: tags,
      meta: {
        total: tags.length
      }
    });
  } catch (error) {
    logger.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags',
      error: error.message
    });
  }
};

// ============ PUBLIC ENDPOINTS ============

export const getPublicNavigation = async (req, res) => {
  try {
    const navigation = await wikiService.getPublicNavigation();
    
    res.json({
      success: true,
      data: navigation
    });
  } catch (error) {
    logger.error('Error fetching public navigation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch navigation',
      error: error.message
    });
  }
};

export const getPublicSection = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const section = await wikiService.getSectionBySlug(slug);
    
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Filter to only published entries for public view
    const publishedEntries = section.entries.filter(entry => entry.isPublished);
    
    res.json({
      success: true,
      data: {
        ...section,
        entries: publishedEntries
      }
    });
  } catch (error) {
    logger.error('Error fetching public section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section',
      error: error.message
    });
  }
};

export const getPublicEntry = async (req, res) => {
  try {
    const { sectionSlug, entrySlug } = req.params;
    
    // First get the section to get its ID
    const section = await wikiService.getSectionBySlug(sectionSlug);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Get the entry and increment view count
    const entry = await wikiService.getEntryBySlug(section.id, entrySlug, true);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found'
      });
    }
    
    res.json({
      success: true,
      data: entry
    });
  } catch (error) {
    logger.error('Error fetching public entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entry',
      error: error.message
    });
  }
};

export const searchPublicEntries = async (req, res) => {
  try {
    const { q: query, section: sectionId } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const results = await wikiService.searchEntries(
      query.trim(),
      sectionId ? parseInt(sectionId) : null
    );
    
    res.json({
      success: true,
      data: results,
      meta: {
        total: results.length,
        query: query.trim()
      }
    });
  } catch (error) {
    logger.error('Error searching entries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search entries',
      error: error.message
    });
  }
};

export const getPublicEntriesByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    
    if (!tag) {
      return res.status(400).json({
        success: false,
        message: 'Tag is required'
      });
    }

    const entries = await wikiService.getEntriesByTag(tag);
    
    res.json({
      success: true,
      data: entries,
      meta: {
        total: entries.length,
        tag
      }
    });
  } catch (error) {
    logger.error('Error fetching entries by tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entries by tag',
      error: error.message
    });
  }
};

export const getPublicTags = async (req, res) => {
  try {
    const tags = await wikiService.getAllTags();
    
    res.json({
      success: true,
      data: tags,
      meta: {
        total: tags.length
      }
    });
  } catch (error) {
    logger.error('Error fetching public tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tags',
      error: error.message
    });
  }
}; 