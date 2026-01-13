import { AppDataSource } from '../data-source.js';
import { MasteryTier } from '../models/masteryTierModel.js';

export class MasteryTierService {
    constructor() {
        this.masteryTierRepository = AppDataSource.getRepository('MasteryTier');
    }

    /**
     * Get all mastery tiers
     * @param {boolean} activeOnly - Filter for active tiers only
     * @returns {Promise<Array>}
     */
    async getAllMasteryTiers(activeOnly = false) {
        const query = { where: {} };

        if (activeOnly) {
            query.where.isActive = true;
        }

        const tiers = await this.masteryTierRepository.find({
            ...query,
            order: { tier: 'ASC' }
        });

        return tiers;
    }

    /**
     * Get mastery tier by ID
     * @param {number} id
     * @returns {Promise<Object|null>}
     */
    async getMasteryTierById(id) {
        return await this.masteryTierRepository.findOne({ where: { id } });
    }

    /**
     * Get mastery tier by tier number
     * @param {number} tier
     * @returns {Promise<Object|null>}
     */
    async getMasteryTierByTierNumber(tier) {
        return await this.masteryTierRepository.findOne({
            where: { tier, isActive: true }
        });
    }

    /**
     * Get mastery tier for a given number of uses
     * @param {number} uses
     * @returns {Promise<Object|null>}
     */
    async getMasteryTierForUses(uses) {
        const tiers = await this.masteryTierRepository.find({
            where: { isActive: true },
            order: { usesRequired: 'DESC' }
        });

        // Find the highest tier where usesRequired <= uses
        for (const tier of tiers) {
            if (uses >= tier.usesRequired) {
                return tier;
            }
        }

        // If no tier found, return the lowest tier (should be tier 1 with 0 uses)
        return tiers[tiers.length - 1] || null;
    }

    /**
     * Create a new mastery tier
     * @param {Object} tierData
     * @returns {Promise<Object>}
     */
    async createMasteryTier(tierData) {
        // Validate required fields
        if (!tierData.tier || !tierData.tierName || tierData.usesRequired === undefined || tierData.multiplier === undefined) {
            throw new Error('Missing required fields: tier, tierName, usesRequired, multiplier');
        }

        // Validate tier number is unique
        const existingTier = await this.masteryTierRepository.findOne({
            where: { tier: tierData.tier }
        });

        if (existingTier) {
            throw new Error(`Tier ${tierData.tier} already exists`);
        }

        // Validate multiplier range
        if (tierData.multiplier < 1.0) {
            throw new Error('Multiplier must be at least 1.00');
        }

        const tier = this.masteryTierRepository.create({
            tier: tierData.tier,
            tierName: tierData.tierName,
            usesRequired: tierData.usesRequired,
            multiplier: tierData.multiplier,
            description: tierData.description || null,
            isActive: tierData.isActive !== undefined ? tierData.isActive : true
        });

        return await this.masteryTierRepository.save(tier);
    }

    /**
     * Update a mastery tier
     * @param {number} id
     * @param {Object} updateData
     * @returns {Promise<Object>}
     */
    async updateMasteryTier(id, updateData) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });

        if (!tier) {
            throw new Error(`Mastery tier with ID ${id} not found`);
        }

        // Validate multiplier if being updated
        if (updateData.multiplier !== undefined && updateData.multiplier < 1.0) {
            throw new Error('Multiplier must be at least 1.00');
        }

        // Validate tier number uniqueness if being updated
        if (updateData.tier !== undefined && updateData.tier !== tier.tier) {
            const existingTier = await this.masteryTierRepository.findOne({
                where: { tier: updateData.tier }
            });

            if (existingTier) {
                throw new Error(`Tier ${updateData.tier} already exists`);
            }
        }

        // Update fields
        if (updateData.tier !== undefined) tier.tier = updateData.tier;
        if (updateData.tierName !== undefined) tier.tierName = updateData.tierName;
        if (updateData.usesRequired !== undefined) tier.usesRequired = updateData.usesRequired;
        if (updateData.multiplier !== undefined) tier.multiplier = updateData.multiplier;
        if (updateData.description !== undefined) tier.description = updateData.description;
        if (updateData.isActive !== undefined) tier.isActive = updateData.isActive;

        return await this.masteryTierRepository.save(tier);
    }

    /**
     * Delete a mastery tier
     * @param {number} id
     * @returns {Promise<boolean>}
     */
    async deleteMasteryTier(id) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });

        if (!tier) {
            return false;
        }

        await this.masteryTierRepository.remove(tier);
        return true;
    }

    /**
     * Initialize default mastery tiers from system.txt v2.2
     * @returns {Promise<Object>}
     */
    async initializeDefaultTiers() {
        const defaultTiers = [
            { tier: 1, tierName: 'Tier I', usesRequired: 0, multiplier: 1.00, description: 'Novice - Base proficiency' },
            { tier: 2, tierName: 'Tier II', usesRequired: 20, multiplier: 1.08, description: 'Apprentice - Growing skill' },
            { tier: 3, tierName: 'Tier III', usesRequired: 40, multiplier: 1.16, description: 'Journeyman - Competent practitioner' },
            { tier: 4, tierName: 'Tier IV', usesRequired: 60, multiplier: 1.24, description: 'Adept - Skilled performer' },
            { tier: 5, tierName: 'Tier V', usesRequired: 80, multiplier: 1.32, description: 'Expert - Highly proficient' },
            { tier: 6, tierName: 'Tier VI', usesRequired: 100, multiplier: 1.40, description: 'Master - Superior expertise' },
            { tier: 7, tierName: 'Tier VII', usesRequired: 120, multiplier: 1.48, description: 'Grandmaster - Elite mastery' },
            { tier: 8, tierName: 'Tier VIII', usesRequired: 150, multiplier: 1.55, description: 'Legend - Exceptional mastery' },
            { tier: 9, tierName: 'Tier IX', usesRequired: 180, multiplier: 1.60, description: 'Mythic - Near-perfect skill' },
            { tier: 10, tierName: 'Tier X', usesRequired: 200, multiplier: 1.65, description: 'Ultimate - Absolute mastery (Cap)' }
        ];

        let createdCount = 0;
        const createdTiers = [];

        for (const tierData of defaultTiers) {
            // Check if tier already exists
            const existing = await this.masteryTierRepository.findOne({
                where: { tier: tierData.tier }
            });

            if (!existing) {
                const newTier = await this.createMasteryTier(tierData);
                createdTiers.push(newTier);
                createdCount++;
            }
        }

        return {
            createdTiers: createdCount,
            tiers: createdTiers
        };
    }
}
