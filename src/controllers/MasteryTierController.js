import { MasteryTierService } from '../services/MasteryTierService.js';

export class MasteryTierController {
    constructor() {
        this.masteryTierService = new MasteryTierService();
    }

    /**
     * Get all mastery tiers
     * Query params: activeOnly
     */
    async getAllMasteryTiers(req, res) {
        try {
            const { activeOnly } = req.query;
            const tiers = await this.masteryTierService.getAllMasteryTiers(
                activeOnly === 'true'
            );
            res.json(tiers);
        } catch (error) {
            console.error('Error in getAllMasteryTiers:', error);
            res.status(500).json({ error: 'Failed to retrieve mastery tiers' });
        }
    }

    /**
     * Get mastery tier by ID
     */
    async getMasteryTierById(req, res) {
        try {
            const { id } = req.params;
            const tier = await this.masteryTierService.getMasteryTierById(parseInt(id));

            if (!tier) {
                return res.status(404).json({ error: 'Mastery tier not found' });
            }

            res.json(tier);
        } catch (error) {
            console.error('Error in getMasteryTierById:', error);
            res.status(500).json({ error: 'Failed to retrieve mastery tier' });
        }
    }

    /**
     * Get mastery tier for a given number of uses
     */
    async getMasteryTierForUses(req, res) {
        try {
            const { uses } = req.params;
            const tier = await this.masteryTierService.getMasteryTierForUses(parseInt(uses));

            if (!tier) {
                return res.status(404).json({ error: 'No mastery tier found for the given uses' });
            }

            res.json(tier);
        } catch (error) {
            console.error('Error in getMasteryTierForUses:', error);
            res.status(500).json({ error: 'Failed to retrieve mastery tier' });
        }
    }

    /**
     * Create a new mastery tier (admin only)
     */
    async createMasteryTier(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const tierData = req.body;
            const tier = await this.masteryTierService.createMasteryTier(tierData);
            res.status(201).json(tier);
        } catch (error) {
            console.error('Error in createMasteryTier:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a mastery tier (admin only)
     */
    async updateMasteryTier(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const updateData = req.body;

            const tier = await this.masteryTierService.updateMasteryTier(
                parseInt(id),
                updateData
            );

            res.json({
                id: tier.id,
                tier: tier.tier,
                tierName: tier.tierName,
                multiplier: tier.multiplier,
                message: 'Mastery tier updated successfully'
            });
        } catch (error) {
            console.error('Error in updateMasteryTier:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: error.message });
            }
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a mastery tier (admin only)
     */
    async deleteMasteryTier(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const success = await this.masteryTierService.deleteMasteryTier(parseInt(id));

            if (success) {
                res.json({ message: 'Mastery tier deleted successfully' });
            } else {
                res.status(404).json({ error: 'Mastery tier not found' });
            }
        } catch (error) {
            console.error('Error in deleteMasteryTier:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Initialize default mastery tiers (admin only)
     */
    async initializeDefaultTiers(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await this.masteryTierService.initializeDefaultTiers();
            res.json({
                createdTiers: result.createdTiers,
                message: 'Mastery tiers initialized successfully',
                tiers: result.tiers
            });
        } catch (error) {
            console.error('Error in initializeDefaultTiers:', error);
            res.status(500).json({ error: 'Failed to initialize default tiers' });
        }
    }
}
