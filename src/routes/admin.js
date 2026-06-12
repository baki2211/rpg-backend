import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import raceRoutes from './race.js';
import combatConstantRoutes from './combatConstant.js';
import masteryTierRoutes from './masteryTier.js';
import staticDataCache from '../utils/staticDataCache.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Admin dashboard route
router.get('/dashboard', authenticateToken, isAdmin, (req, res) => {
    res.status(200).json({ message: 'Welcome to the admin dashboard!' });
});

// Reload the entire static-data cache (races, skills, stat defs, etc).
// Use after direct SQL edits to those tables so the change is visible
// without a process restart.
router.post('/cache/reload', authenticateToken, isAdmin, async (req, res) => {
    try {
        staticDataCache.clear();
        staticDataCache.isInitialized = false;
        await staticDataCache.preloadCache();
        logger.info('Static data cache reloaded by admin', { userId: req.user?.id });
        res.status(200).json({
            success: true,
            stats: staticDataCache.getStats()
        });
    } catch (error) {
        logger.error('Cache reload failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reload a single entity. Entity name must match the cache key prefix
// (Race, Skill, SkillBranch, SkillType, StatDefinition, Rank).
router.post('/cache/reload/:entity', authenticateToken, isAdmin, async (req, res) => {
    const { entity } = req.params;
    const reloaders = {
        Race: () => staticDataCache.getRaces(),
        Skill: () => staticDataCache.getSkills(true),
        SkillBranch: () => staticDataCache.getSkillBranches(),
        SkillType: () => staticDataCache.getSkillTypes(),
        StatDefinition: () => staticDataCache.getStatDefinitions(),
        Rank: () => staticDataCache.getRanks()
    };

    if (!reloaders[entity]) {
        return res.status(400).json({
            success: false,
            error: `Unknown entity '${entity}'. Valid: ${Object.keys(reloaders).join(', ')}`
        });
    }

    try {
        staticDataCache.clearEntity(entity);
        await reloaders[entity]();
        logger.info('Static data cache entity reloaded by admin', {
            userId: req.user?.id,
            entity
        });
        res.status(200).json({ success: true, entity, stats: staticDataCache.getStats() });
    } catch (error) {
        logger.error('Entity cache reload failed', { entity, error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// Nested race management routes
router.use('/races', authenticateToken, isAdmin, raceRoutes);

// Nested combat constants management routes
router.use('/combat-constants', authenticateToken, isAdmin, combatConstantRoutes);

// Nested mastery tier management routes
router.use('/mastery-tiers', authenticateToken, isAdmin, masteryTierRoutes);

export default router;
