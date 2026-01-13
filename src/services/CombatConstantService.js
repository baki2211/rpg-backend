import { AppDataSource } from '../data-source.js';
import { CombatConstant } from '../models/combatConstantModel.js';
import staticDataCache from '../utils/staticDataCache.js';

export class CombatConstantService {
    constructor() {
        this.combatConstantRepository = AppDataSource.getRepository(CombatConstant);
    }

    /**
     * Get all combat constants
     * @param {string} category - Optional category filter
     * @param {boolean} activeOnly - Only return active constants
     * @returns {Promise<Array>} Array of combat constants
     */
    async getAllCombatConstants(category = null, activeOnly = false) {
        const where = {};

        if (category) {
            where.category = category;
        }

        if (activeOnly) {
            where.isActive = true;
        }

        return await this.combatConstantRepository.find({ where });
    }

    /**
     * Get combat constant by ID
     * @param {number} id - Combat constant ID
     * @returns {Promise<Object|null>} Combat constant or null
     */
    async getCombatConstantById(id) {
        return await this.combatConstantRepository.findOne({ where: { id } });
    }

    /**
     * Get combat constant by key
     * @param {string} constantKey - Constant key
     * @returns {Promise<Object|null>} Combat constant or null
     */
    async getCombatConstantByKey(constantKey) {
        return await this.combatConstantRepository.findOne({ where: { constantKey } });
    }

    /**
     * Get constants organized by category
     * @param {boolean} activeOnly - Only return active constants
     * @returns {Promise<Object>} Constants organized by category
     */
    async getConstantsByCategory(activeOnly = true) {
        const constants = await this.getAllCombatConstants(null, activeOnly);

        const organized = {
            hp_system: [],
            aether_system: [],
            damage_system: [],
            mastery_system: [],
            outcome_system: []
        };

        constants.forEach(constant => {
            if (organized[constant.category]) {
                organized[constant.category].push(constant);
            }
        });

        return organized;
    }

    /**
     * Create a new combat constant
     * @param {Object} constantData - Combat constant data
     * @returns {Promise<Object>} Created combat constant
     */
    async createCombatConstant(constantData) {
        // Validate category
        const validCategories = ['hp_system', 'aether_system', 'damage_system', 'mastery_system', 'outcome_system'];
        if (!validCategories.includes(constantData.category)) {
            throw new Error('Invalid category. Must be one of: hp_system, aether_system, damage_system, mastery_system, outcome_system');
        }

        // Validate constant key format
        if (!/^[A-Z_0-9]+$/.test(constantData.constantKey)) {
            throw new Error('Constant key must contain only uppercase letters, numbers, and underscores');
        }

        // Check if constant key already exists
        const existing = await this.getCombatConstantByKey(constantData.constantKey);
        if (existing) {
            throw new Error('A constant with this key already exists');
        }

        // Validate min/max values
        if (constantData.minValue !== undefined && constantData.maxValue !== undefined) {
            if (constantData.maxValue < constantData.minValue) {
                throw new Error('Maximum value cannot be less than minimum value');
            }
        }

        // Validate value is within range
        if (constantData.minValue !== undefined && constantData.value < constantData.minValue) {
            throw new Error(`Value must be at least ${constantData.minValue}`);
        }
        if (constantData.maxValue !== undefined && constantData.value > constantData.maxValue) {
            throw new Error(`Value must be at most ${constantData.maxValue}`);
        }

        const combatConstant = this.combatConstantRepository.create(constantData);
        const savedConstant = await this.combatConstantRepository.save(combatConstant);
        staticDataCache.clearEntity('CombatConstant');
        return savedConstant;
    }

    /**
     * Update a combat constant's value
     * @param {number} id - Combat constant ID
     * @param {Object} updateData - Data to update (typically just { value })
     * @returns {Promise<Object>} Updated combat constant
     */
    async updateCombatConstant(id, updateData) {
        const constant = await this.getCombatConstantById(id);
        if (!constant) {
            throw new Error('Combat constant not found');
        }

        if (!constant.isActive) {
            throw new Error('Cannot update inactive combat constant');
        }

        // If updating value, validate against min/max
        if (updateData.value !== undefined) {
            if (constant.minValue !== null && updateData.value < constant.minValue) {
                throw new Error(`Value must be at least ${constant.minValue}`);
            }
            if (constant.maxValue !== null && updateData.value > constant.maxValue) {
                throw new Error(`Value must be at most ${constant.maxValue}`);
            }
        }

        await this.combatConstantRepository.update(id, updateData);
        staticDataCache.clearEntity('CombatConstant');
        return await this.combatConstantRepository.findOne({ where: { id } });
    }

    /**
     * Delete a combat constant
     * @param {number} id - Combat constant ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteCombatConstant(id) {
        const constant = await this.getCombatConstantById(id);
        if (!constant) {
            throw new Error('Combat constant not found');
        }

        const result = await this.combatConstantRepository.delete(id);
        if (result.affected > 0) {
            staticDataCache.clearEntity('CombatConstant');
        }
        return result.affected > 0;
    }

    /**
     * Initialize default combat constants from system.txt v2.2
     * @returns {Promise<Object>} Object with createdConstants count and list
     */
    async initializeDefaultConstants() {
        const defaultConstants = [
            // HP System
            {
                constantKey: 'HP_SCALE',
                displayName: 'HP Scaling Factor',
                description: 'Multiplier for RES stat in MaxHP calculation (MaxHP = BHP + RES × HP_SCALE)',
                value: 10,
                category: 'hp_system',
                minValue: 1,
                maxValue: 50,
                isPercentage: false
            },
            {
                constantKey: 'DAMAGE_REDUCTION_RATE',
                displayName: 'Damage Reduction Rate',
                description: 'Damage reduction per point of RES (0.02 = 2% per RES)',
                value: 0.02,
                category: 'hp_system',
                minValue: 0.001,
                maxValue: 0.1,
                isPercentage: true
            },
            {
                constantKey: 'DAMAGE_REDUCTION_CAP',
                displayName: 'Damage Reduction Cap',
                description: 'Maximum damage reduction percentage (0.40 = 40% cap)',
                value: 0.40,
                category: 'hp_system',
                minValue: 0.1,
                maxValue: 0.95,
                isPercentage: true
            },

            // Aether System
            {
                constantKey: 'AETHER_FOC_MULT',
                displayName: 'Aether FOC Multiplier',
                description: 'FOC multiplier in MaxAether calculation (MaxAether = BAE + FOC × 8 + FOR × 4)',
                value: 8,
                category: 'aether_system',
                minValue: 1,
                maxValue: 20,
                isPercentage: false
            },
            {
                constantKey: 'AETHER_FOR_MULT',
                displayName: 'Aether FOR Multiplier',
                description: 'FOR multiplier in MaxAether calculation',
                value: 4,
                category: 'aether_system',
                minValue: 1,
                maxValue: 20,
                isPercentage: false
            },
            {
                constantKey: 'AETHER_REGEN_FOC_DIV',
                displayName: 'Aether Regen FOC Divisor',
                description: 'FOC divisor in AetherRegen calculation (AetherRegen = BAR + floor(FOC / 2))',
                value: 2,
                category: 'aether_system',
                minValue: 1,
                maxValue: 10,
                isPercentage: false
            },

            // Damage System
            {
                constantKey: 'IMPACT_FOR_SCALE',
                displayName: 'Impact FOR Scaling',
                description: 'FOR contribution to Impact (Impact = basePower + FOR × scale)',
                value: 1,
                category: 'damage_system',
                minValue: 0.1,
                maxValue: 5,
                isPercentage: false
            },

            // Mastery System
            {
                constantKey: 'MASTERY_CAP',
                displayName: 'Mastery Multiplier Cap',
                description: 'Maximum mastery multiplier (1.65 = 165%)',
                value: 1.65,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 3.0,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_1',
                displayName: 'Mastery Tier I',
                description: 'Tier I mastery multiplier',
                value: 1.00,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_2',
                displayName: 'Mastery Tier II',
                description: 'Tier II mastery multiplier',
                value: 1.08,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_3',
                displayName: 'Mastery Tier III',
                description: 'Tier III mastery multiplier',
                value: 1.16,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_4',
                displayName: 'Mastery Tier IV',
                description: 'Tier IV mastery multiplier',
                value: 1.24,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_5',
                displayName: 'Mastery Tier V',
                description: 'Tier V mastery multiplier',
                value: 1.32,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_6',
                displayName: 'Mastery Tier VI',
                description: 'Tier VI mastery multiplier',
                value: 1.40,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_7',
                displayName: 'Mastery Tier VII',
                description: 'Tier VII mastery multiplier',
                value: 1.48,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_8',
                displayName: 'Mastery Tier VIII',
                description: 'Tier VIII mastery multiplier',
                value: 1.55,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_9',
                displayName: 'Mastery Tier IX',
                description: 'Tier IX mastery multiplier',
                value: 1.60,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },
            {
                constantKey: 'MASTERY_TIER_10',
                displayName: 'Mastery Tier X (Cap)',
                description: 'Tier X mastery multiplier (maximum)',
                value: 1.65,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            },

            // Outcome System
            {
                constantKey: 'OUTCOME_POOR_MULT',
                displayName: 'Poor Outcome Multiplier',
                description: 'Damage multiplier for poor quality outcomes',
                value: 0.9,
                category: 'outcome_system',
                minValue: 0.5,
                maxValue: 1.0,
                isPercentage: false
            },
            {
                constantKey: 'OUTCOME_STANDARD_MULT',
                displayName: 'Standard Outcome Multiplier',
                description: 'Damage multiplier for standard quality outcomes',
                value: 1.0,
                category: 'outcome_system',
                minValue: 0.8,
                maxValue: 1.2,
                isPercentage: false
            },
            {
                constantKey: 'OUTCOME_CRITICAL_MULT',
                displayName: 'Critical Outcome Multiplier',
                description: 'Damage multiplier for critical quality outcomes (capped at 1.15 per system.txt)',
                value: 1.15,
                category: 'outcome_system',
                minValue: 1.0,
                maxValue: 2.0,
                isPercentage: false
            }
        ];

        const createdConstants = [];
        for (const constantData of defaultConstants) {
            try {
                const existing = await this.getCombatConstantByKey(constantData.constantKey);
                if (!existing) {
                    const created = await this.createCombatConstant(constantData);
                    createdConstants.push(created);
                }
            } catch (error) {
                console.log(`Constant ${constantData.constantKey} already exists, skipping...`);
            }
        }

        return {
            createdConstants: createdConstants.length,
            constants: createdConstants
        };
    }
}
