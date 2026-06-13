import express from 'express';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { WikiController } from '../controllers/WikiController.js';

const router = express.Router();
const masterOrAdmin = requireRole(['admin', 'master']);

// ============ ADMIN ROUTES (Require admin/master role) ============

router.use('/admin', authenticateToken, masterOrAdmin);

// Section management
router.get('/admin/sections', WikiController.adminGetSections);
router.post('/admin/sections', WikiController.adminCreateSection);
router.put('/admin/sections/reorder', WikiController.adminReorderSections);
router.put('/admin/sections/:id', WikiController.adminUpdateSection);
router.delete('/admin/sections/:id', WikiController.adminDeleteSection);

// Entry management
router.get('/admin/sections/:sectionId/entries', WikiController.adminGetEntries);
router.get('/admin/sections/:sectionId/entries/hierarchical', WikiController.adminGetEntriesHierarchical);
router.put('/admin/sections/:sectionId/entries/reorder', WikiController.adminReorderEntries);
router.get('/admin/entries', WikiController.adminGetAllEntries);
router.get('/admin/entries/:id', WikiController.adminGetEntry);
router.post('/admin/entries', WikiController.adminCreateEntry);
router.put('/admin/entries/:id', WikiController.adminUpdateEntry);
router.delete('/admin/entries/:id', WikiController.adminDeleteEntry);

// Utility endpoints
router.get('/admin/stats', WikiController.adminGetWikiStats);
router.get('/admin/tags', WikiController.adminGetAllTags);

// ============ PUBLIC ROUTES (No authentication required) ============

// Navigation and browsing
router.get('/navigation', WikiController.getPublicNavigation);
router.get('/sections/:slug', WikiController.getPublicSection);
router.get('/sections/:sectionSlug/entries/:entrySlug', WikiController.getPublicEntry);

// Search and discovery
router.get('/search', WikiController.searchPublicEntries);
router.get('/tags/:tag/entries', WikiController.getPublicEntriesByTag);
router.get('/tags', WikiController.getPublicTags);

export default router;
