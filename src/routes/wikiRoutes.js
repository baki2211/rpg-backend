import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {
  // Admin Section endpoints
  adminGetSections,
  adminCreateSection,
  adminUpdateSection,
  adminDeleteSection,
  adminReorderSections,
  
  // Admin Entry endpoints
  adminGetEntries,
  adminGetEntry,
  adminCreateEntry,
  adminUpdateEntry,
  adminDeleteEntry,
  adminReorderEntries,
  
  // Admin Utility endpoints
  adminGetWikiStats,
  adminGetAllTags,
  
  // Public endpoints
  getPublicNavigation,
  getPublicSection,
  getPublicEntry,
  searchPublicEntries,
  getPublicEntriesByTag,
  getPublicTags
} from '../controllers/wikiController.js';

const router = express.Router();

// ============ ADMIN ROUTES (Require admin/master role) ============

// Section management
router.get('/admin/sections', authenticateToken, requireRole(['admin', 'master']), adminGetSections);
router.post('/admin/sections', authenticateToken, requireRole(['admin', 'master']), adminCreateSection);
router.put('/admin/sections/:id', authenticateToken, requireRole(['admin', 'master']), adminUpdateSection);
router.delete('/admin/sections/:id', authenticateToken, requireRole(['admin', 'master']), adminDeleteSection);
router.put('/admin/sections/reorder', authenticateToken, requireRole(['admin', 'master']), adminReorderSections);

// Entry management
router.get('/admin/sections/:sectionId/entries', authenticateToken, requireRole(['admin', 'master']), adminGetEntries);
router.get('/admin/entries/:id', authenticateToken, requireRole(['admin', 'master']), adminGetEntry);
router.post('/admin/entries', authenticateToken, requireRole(['admin', 'master']), adminCreateEntry);
router.put('/admin/entries/:id', authenticateToken, requireRole(['admin', 'master']), adminUpdateEntry);
router.delete('/admin/entries/:id', authenticateToken, requireRole(['admin', 'master']), adminDeleteEntry);
router.put('/admin/sections/:sectionId/entries/reorder', authenticateToken, requireRole(['admin', 'master']), adminReorderEntries);


router.get('/admin/tags', authenticateToken, requireRole(['admin', 'master']), adminGetAllTags);

// ============ PUBLIC ROUTES (No authentication required) ============

// Navigation and browsing
router.get('/navigation', getPublicNavigation);
router.get('/sections/:slug', getPublicSection);
router.get('/sections/:sectionSlug/entries/:entrySlug', getPublicEntry);

// Search and discovery
router.get('/search', searchPublicEntries);
router.get('/tags/:tag/entries', getPublicEntriesByTag);
router.get('/tags', getPublicTags);

export default router; 