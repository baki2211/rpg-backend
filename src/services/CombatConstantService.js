import { AppDataSource } from '../data-source.js';
import { CombatConstant } from '../models/combatConstantModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { HttpError } from '../utils/HttpError.js';
import { DEFAULT_CHAT_RULES, CHAT_RULE_KEYS } from '../domain/chat/messageRewards.js';
import { DEFAULT_BRANCH_RANKS } from '../domain/skills/ranks.js';
import { DEFAULT_OUTCOMES } from '../domain/skills/outcome.js';
import { BRANCH_RANK_MULTIPLIER_KEYS, OUTCOME_MULTIPLIER_KEYS } from '../domain/skills/rules.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const defaultOutcomeMultiplier = (quality) => DEFAULT_OUTCOMES.find(outcome => outcome.quality === quality).multiplier;

const VALID_CATEGORIES = ['hp_system', 'aether_system', 'damage_system', 'mastery_system', 'outcome_system', 'chat_system'];
const CONSTANT_KEY_PATTERN = /^[A-Z_0-9]+$/;

export class CombatConstantService {
    constructor() {
        this.combatConstantRepository = AppDataSource.getRepository(CombatConstant);
    }

    async getAllCombatConstants(category = null, activeOnly = false) {
        const where = {};
        if (category) where.category = category;
        if (activeOnly) where.isActive = true;
        return await this.combatConstantRepository.find({ where });
    }

    async getCombatConstantById(id) {
        const constant = await this.combatConstantRepository.findOne({ where: { id } });
        if (!constant) throw new HttpError(404, 'Combat constant not found');
        return constant;
    }

    async getCombatConstantByKey(constantKey) {
        return await this.combatConstantRepository.findOne({ where: { constantKey } });
    }

    async getConstantsByCategory(activeOnly = true) {
        const constants = await this.getAllCombatConstants(null, activeOnly);

        const organized = {
            hp_system: [],
            aether_system: [],
            damage_system: [],
            mastery_system: [],
            outcome_system: [],
            chat_system: []
        };

        constants.forEach(constant => {
            if (organized[constant.category]) {
                organized[constant.category].push(constant);
            }
        });

        return organized;
    }

    async createCombatConstant(constantData) {
        if (!VALID_CATEGORIES.includes(constantData.category)) {
            throw new HttpError(400, 'Invalid category. Must be one of: ' + VALID_CATEGORIES.join(', '));
        }

        if (!CONSTANT_KEY_PATTERN.test(constantData.constantKey)) {
            throw new HttpError(400, 'Constant key must contain only uppercase letters, numbers, and underscores');
        }

        const existing = await this.getCombatConstantByKey(constantData.constantKey);
        if (existing) {
            throw new HttpError(409, 'A constant with this key already exists');
        }

        if (constantData.minValue !== undefined && constantData.maxValue !== undefined) {
            if (constantData.maxValue < constantData.minValue) {
                throw new HttpError(400, 'Maximum value cannot be less than minimum value');
            }
        }

        if (constantData.minValue !== undefined && constantData.value < constantData.minValue) {
            throw new HttpError(400, `Value must be at least ${constantData.minValue}`);
        }
        if (constantData.maxValue !== undefined && constantData.value > constantData.maxValue) {
            throw new HttpError(400, `Value must be at most ${constantData.maxValue}`);
        }

        const combatConstant = this.combatConstantRepository.create(constantData);
        const savedConstant = await this.combatConstantRepository.save(combatConstant);
        staticDataCache.clearEntity('CombatConstant');
        return savedConstant;
    }

    async updateCombatConstant(id, updateData) {
        const constant = await this.combatConstantRepository.findOne({ where: { id } });
        if (!constant) {
            throw new HttpError(404, 'Combat constant not found');
        }

        if (!constant.isActive) {
            throw new HttpError(400, 'Cannot update inactive combat constant');
        }

        if (updateData.value !== undefined) {
            if (constant.minValue !== null && updateData.value < constant.minValue) {
                throw new HttpError(400, `Value must be at least ${constant.minValue}`);
            }
            if (constant.maxValue !== null && updateData.value > constant.maxValue) {
                throw new HttpError(400, `Value must be at most ${constant.maxValue}`);
            }
        }

        await this.combatConstantRepository.update(id, updateData);
        staticDataCache.clearEntity('CombatConstant');
        return await this.combatConstantRepository.findOne({ where: { id } });
    }

    async deleteCombatConstant(id) {
        const result = await this.combatConstantRepository.delete(id);
        if (!result.affected) {
            throw new HttpError(404, 'Combat constant not found');
        }
        staticDataCache.clearEntity('CombatConstant');
    }

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
            // Branch rank multipliers, read by the engine (src/domain/skills/rules.js).
            // The key keeps its historical MASTERY_TIER_n name; the uses thresholds stay in code.
            ...DEFAULT_BRANCH_RANKS.map(({ rank, minUses, multiplier }, index) => ({
                constantKey: BRANCH_RANK_MULTIPLIER_KEYS[index],
                displayName: `Branch Rank ${ROMAN[index]} Multiplier`,
                description: `Branch rank multiplier once the branch has ${minUses} uses (rank ${rank})`,
                value: multiplier,
                category: 'mastery_system',
                minValue: 1.0,
                maxValue: 1.65,
                isPercentage: false
            })),

            // Outcome System
            {
                constantKey: OUTCOME_MULTIPLIER_KEYS.Poor,
                displayName: 'Poor Outcome Multiplier',
                description: 'Skill output multiplier for a Poor success (d20 roll 1-3)',
                value: defaultOutcomeMultiplier('Poor'),
                category: 'outcome_system',
                minValue: 0.5,
                maxValue: 1.0,
                isPercentage: false
            },
            {
                constantKey: OUTCOME_MULTIPLIER_KEYS.Standard,
                displayName: 'Standard Outcome Multiplier',
                description: 'Skill output multiplier for a Standard success (d20 roll 4-17)',
                value: defaultOutcomeMultiplier('Standard'),
                category: 'outcome_system',
                minValue: 0.8,
                maxValue: 1.2,
                isPercentage: false
            },
            {
                constantKey: OUTCOME_MULTIPLIER_KEYS.Critical,
                displayName: 'Critical Outcome Multiplier',
                description: 'Skill output multiplier for a Critical success (d20 roll 18-20)',
                value: defaultOutcomeMultiplier('Critical'),
                category: 'outcome_system',
                minValue: 1.0,
                maxValue: 2.0,
                isPercentage: false
            },

            // Chat System
            {
                constantKey: CHAT_RULE_KEYS.minLength,
                displayName: 'Chat Post Minimum Length',
                description: 'A chat post must be longer than this many characters to count for sessions and experience',
                value: DEFAULT_CHAT_RULES.minLength,
                category: 'chat_system',
                minValue: 0,
                maxValue: 1000,
                isPercentage: false
            },
            {
                constantKey: CHAT_RULE_KEYS.cooldownMs,
                displayName: 'Chat Experience Cooldown (ms)',
                description: 'Minimum time between two experience-granting chat posts by the same user, in milliseconds',
                value: DEFAULT_CHAT_RULES.cooldownMs,
                category: 'chat_system',
                minValue: 0,
                maxValue: 600000, // decimal(10,4) holds at most 999999.9999
                isPercentage: false
            }
        ];

        const createdConstants = [];
        for (const constantData of defaultConstants) {
            const existing = await this.getCombatConstantByKey(constantData.constantKey);
            if (!existing) {
                createdConstants.push(await this.createCombatConstant(constantData));
            }
        }

        return {
            createdConstants: createdConstants.length,
            constants: createdConstants
        };
    }
}
