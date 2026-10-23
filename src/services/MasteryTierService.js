import { AppDataSource } from '../data-source.js';
import { MasteryTier } from '../models/masteryTierModel.js';
import { HttpError } from '../utils/HttpError.js';
import staticDataCache from '../utils/staticDataCache.js';
import { DEFAULT_SKILL_RANKS, skillRankFor } from '../domain/skills/ranks.js';

// Display text for the seeded tiers; uses and multipliers come from the skill rank ladder.
const DEFAULT_TIER_TEXT = {
    1: { tierName: 'Tier I', description: 'Novice - Base proficiency' },
    2: { tierName: 'Tier II', description: 'Apprentice - Growing skill' },
    3: { tierName: 'Tier III', description: 'Journeyman - Competent practitioner' },
    4: { tierName: 'Tier IV', description: 'Adept - Skilled performer' },
    5: { tierName: 'Tier V', description: 'Expert - Highly proficient' }
};

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

    /**
     * The skill rank the engine gives for a number of uses, as a mastery tier.
     * Same ladder as the skill formulas (staticDataCache.getSkillRules, src/domain/skills/ranks.js):
     * the matching active row, or the code default tier when the rows don't form a valid ladder.
     */
    async getMasteryTierForUses(uses) {
        const [{ skillRanks }, activeTiers] = await Promise.all([
            staticDataCache.getSkillRules(),
            staticDataCache.getMasteryTiers()
        ]);
        const { rank } = skillRankFor(uses, skillRanks);

        const row = activeTiers.find(tier => tier.tier === rank);
        if (row) return row;

        const { minUses, multiplier } = skillRanks.find(entry => entry.rank === rank);
        return { tier: rank, usesRequired: minUses, multiplier, isActive: true, ...DEFAULT_TIER_TEXT[rank] };
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

        const savedTier = await this.masteryTierRepository.save(tier);
        staticDataCache.clearEntity('MasteryTier');
        return savedTier;
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

        const savedTier = await this.masteryTierRepository.save(tier);
        staticDataCache.clearEntity('MasteryTier');
        return savedTier;
    }

    async deleteMasteryTier(id) {
        const tier = await this.masteryTierRepository.findOne({ where: { id } });
        if (!tier) {
            throw new HttpError(404, 'Mastery tier not found');
        }
        await this.masteryTierRepository.remove(tier);
        staticDataCache.clearEntity('MasteryTier');
    }

    async initializeDefaultTiers() {
        // The active tiers are the skill rank ladder read by the engine (src/domain/skills/rules.js)
        const defaultTiers = DEFAULT_SKILL_RANKS.map(({ rank, minUses, multiplier }) => ({
            tier: rank,
            usesRequired: minUses,
            multiplier,
            ...DEFAULT_TIER_TEXT[rank]
        }));

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
