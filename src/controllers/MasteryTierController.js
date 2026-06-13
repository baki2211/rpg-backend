import { MasteryTierService } from '../services/MasteryTierService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const masteryTierService = new MasteryTierService();

const formatTier = (tier) => ({ ...tier, multiplier: parseFloat(tier.multiplier) });

export class MasteryTierController {
    static getAllMasteryTiers = asyncHandler(async (req, res) => {
        const { activeOnly } = req.query;
        const tiers = await masteryTierService.getAllMasteryTiers(activeOnly === 'true');
        res.json(tiers.map(formatTier));
    });

    static getMasteryTierById = asyncHandler(async (req, res) => {
        const tier = await masteryTierService.getMasteryTierById(parseInt(req.params.id));
        res.json(formatTier(tier));
    });

    static getMasteryTierForUses = asyncHandler(async (req, res) => {
        const tier = await masteryTierService.getMasteryTierForUses(parseInt(req.params.uses));
        res.json(formatTier(tier));
    });

    static createMasteryTier = asyncHandler(async (req, res) => {
        const tier = await masteryTierService.createMasteryTier(req.body);
        res.status(201).json(formatTier(tier));
    });

    static updateMasteryTier = asyncHandler(async (req, res) => {
        const tier = await masteryTierService.updateMasteryTier(parseInt(req.params.id), req.body);
        res.json(formatTier(tier));
    });

    static deleteMasteryTier = asyncHandler(async (req, res) => {
        await masteryTierService.deleteMasteryTier(parseInt(req.params.id));
        res.json({ message: 'Mastery tier deleted successfully' });
    });

    static initializeDefaultTiers = asyncHandler(async (req, res) => {
        const result = await masteryTierService.initializeDefaultTiers();
        res.json({
            message: 'Mastery tiers initialized successfully',
            createdTiers: result.createdTiers,
            tiers: result.tiers.map(formatTier)
        });
    });
}
