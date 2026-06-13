import { AppDataSource } from '../data-source.js';
import { MasteryTier } from '../models/masteryTierModel.js';
import { HttpError } from '../utils/HttpError.js';

export class MasteryTierService {
    constructor() {
        this.masteryTierRepository = AppDataSource.getRepository('MasteryTier');
    }

    async getAllMasteryTiers(activeOnly = false) {
        const where = activeOnly ? { isActive: true } : {};
        return await this.masteryTierRepository.find({ where, order: { tier: 'ASC' } });
    }

    async getMasteryTierById(id) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });
        if (!tier) throw new HttpError(404, 'Mastery tier not found');
        return tier;
    }

    async getMasteryTierByTierNumber(tier) {
        return await this.masteryTierRepository.findOne({
            where: { tier, isActive: true }
        });
    }

    async getMasteryTierForUses(uses) {
        const tiers = await this.masteryTierRepository.find({
            where: { isActive: true },
            order: { usesRequired: 'DESC' }
        });

        for (const tier of tiers) {
            if (uses >= tier.usesRequired) {
                return tier;
            }
        }

        const fallback = tiers[tiers.length - 1];
        if (!fallback) throw new HttpError(404, 'No mastery tier found for the given uses');
        return fallback;
    }

    async createMasteryTier(tierData) {
        if (!tierData.tier || !tierData.tierName || tierData.usesRequired === undefined || tierData.multiplier === undefined) {
            throw new HttpError(400, 'Missing required fields: tier, tierName, usesRequired, multiplier');
        }

        if (tierData.multiplier < 1.0) {
            throw new HttpError(400, 'Multiplier must be at least 1.00');
        }

        const existingTier = await this.masteryTierRepository.findOne({
            where: { tier: tierData.tier }
        });
        if (existingTier) {
            throw new HttpError(409, `Tier ${tierData.tier} already exists`);
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

    async updateMasteryTier(id, updateData) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });
        if (!tier) {
            throw new HttpError(404, `Mastery tier with ID ${id} not found`);
        }

        if (updateData.multiplier !== undefined && updateData.multiplier < 1.0) {
            throw new HttpError(400, 'Multiplier must be at least 1.00');
        }

        if (updateData.tier !== undefined && updateData.tier !== tier.tier) {
            const existingTier = await this.masteryTierRepository.findOne({
                where: { tier: updateData.tier }
            });
            if (existingTier) {
                throw new HttpError(409, `Tier ${updateData.tier} already exists`);
            }
        }

        if (updateData.tier !== undefined) tier.tier = updateData.tier;
        if (updateData.tierName !== undefined) tier.tierName = updateData.tierName;
        if (updateData.usesRequired !== undefined) tier.usesRequired = updateData.usesRequired;
        if (updateData.multiplier !== undefined) tier.multiplier = updateData.multiplier;
        if (updateData.description !== undefined) tier.description = updateData.description;
        if (updateData.isActive !== undefined) tier.isActive = updateData.isActive;

        return await this.masteryTierRepository.save(tier);
    }

    async deleteMasteryTier(id) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });
        if (!tier) {
            throw new HttpError(404, 'Mastery tier not found');
        }
        await this.masteryTierRepository.remove(tier);
    }

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

        const createdTiers = [];
        for (const tierData of defaultTiers) {
            const existing = await this.masteryTierRepository.findOne({
                where: { tier: tierData.tier }
            });
            if (!existing) {
                createdTiers.push(await this.createMasteryTier(tierData));
            }
        }

        return {
            createdTiers: createdTiers.length,
            tiers: createdTiers
        };
    }
}
