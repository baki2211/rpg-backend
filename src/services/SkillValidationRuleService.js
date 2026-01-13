import { AppDataSource } from '../data-source.js';
import { SkillValidationRule } from '../models/skillValidationRuleModel.js';
import staticDataCache from '../utils/staticDataCache.js';

export class SkillValidationRuleService {
    constructor() {
        this.ruleRepository = AppDataSource.getRepository(SkillValidationRule);
    }

    /**
     * Get all skill validation rules
     * @param {string} skillType - Optional skill type filter
     * @param {boolean} activeOnly - Only return active rules
     * @returns {Promise<Array>} Array of validation rules
     */
    async getAllRules(skillType = null, activeOnly = false) {
        const where = {};

        if (skillType) {
            where.skillType = skillType;
        }

        if (activeOnly) {
            where.isActive = true;
        }

        return await this.ruleRepository.find({ where });
    }

    /**
     * Get skill validation rule by ID
     * @param {number} id - Rule ID
     * @returns {Promise<Object|null>} Validation rule or null
     */
    async getRuleById(id) {
        return await this.ruleRepository.findOne({ where: { id } });
    }

    /**
     * Get skill validation rule by type and subtype
     * @param {string} skillType - Skill type
     * @param {string} skillSubtype - Skill subtype
     * @returns {Promise<Object|null>} Validation rule or null
     */
    async getRuleByTypeAndSubtype(skillType, skillSubtype) {
        return await this.ruleRepository.findOne({
            where: { skillType, skillSubtype }
        });
    }

    /**
     * Get rules organized by category (skill type)
     * @param {boolean} activeOnly - Only return active rules
     * @returns {Promise<Object>} Rules organized by skill type
     */
    async getRulesByCategory(activeOnly = true) {
        const rules = await this.getAllRules(null, activeOnly);

        const organized = {
            attack: [],
            defence: [],
            counter: [],
            buff_debuff: [],
            healing: []
        };

        rules.forEach(rule => {
            if (organized[rule.skillType]) {
                organized[rule.skillType].push(rule);
            }
        });

        return organized;
    }

    /**
     * Create a new skill validation rule
     * @param {Object} ruleData - Validation rule data
     * @returns {Promise<Object>} Created validation rule
     */
    async createRule(ruleData) {
        // Validate skill type
        const validTypes = ['attack', 'defence', 'counter', 'buff_debuff', 'healing'];
        if (!validTypes.includes(ruleData.skillType)) {
            throw new Error('Invalid skill type. Must be one of: attack, defence, counter, buff_debuff, healing');
        }

        // Check if rule for this type/subtype already exists
        const existing = await this.getRuleByTypeAndSubtype(ruleData.skillType, ruleData.skillSubtype);
        if (existing) {
            throw new Error('A validation rule for this skill type and subtype already exists');
        }

        // Validate min/max values
        if (ruleData.maxBasePower < ruleData.minBasePower) {
            throw new Error('Maximum base power cannot be less than minimum base power');
        }
        if (ruleData.maxAetherCost < ruleData.minAetherCost) {
            throw new Error('Maximum aether cost cannot be less than minimum aether cost');
        }

        const rule = this.ruleRepository.create(ruleData);
        const savedRule = await this.ruleRepository.save(rule);
        staticDataCache.clearEntity('SkillValidationRule');
        return savedRule;
    }

    /**
     * Update a skill validation rule
     * @param {number} id - Rule ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated validation rule
     */
    async updateRule(id, updateData) {
        const rule = await this.getRuleById(id);
        if (!rule) {
            throw new Error('Skill validation rule not found');
        }

        // Validate min/max values if they're being updated
        const minBasePower = updateData.minBasePower !== undefined ? updateData.minBasePower : rule.minBasePower;
        const maxBasePower = updateData.maxBasePower !== undefined ? updateData.maxBasePower : rule.maxBasePower;
        const minAetherCost = updateData.minAetherCost !== undefined ? updateData.minAetherCost : rule.minAetherCost;
        const maxAetherCost = updateData.maxAetherCost !== undefined ? updateData.maxAetherCost : rule.maxAetherCost;

        if (maxBasePower < minBasePower) {
            throw new Error('Maximum base power cannot be less than minimum base power');
        }
        if (maxAetherCost < minAetherCost) {
            throw new Error('Maximum aether cost cannot be less than minimum aether cost');
        }

        await this.ruleRepository.update(id, updateData);
        staticDataCache.clearEntity('SkillValidationRule');
        return await this.ruleRepository.findOne({ where: { id } });
    }

    /**
     * Delete a skill validation rule
     * @param {number} id - Rule ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteRule(id) {
        const rule = await this.getRuleById(id);
        if (!rule) {
            throw new Error('Skill validation rule not found');
        }

        const result = await this.ruleRepository.delete(id);
        if (result.affected > 0) {
            staticDataCache.clearEntity('SkillValidationRule');
        }
        return result.affected > 0;
    }

    /**
     * Initialize default skill validation rules from system.txt v2.2
     * @returns {Promise<Object>} Object with createdRules count and list
     */
    async initializeDefaultRules() {
        const defaultRules = [
            // Attack Skills
            {
                skillType: 'attack',
                skillSubtype: 'light',
                minBasePower: 6,
                maxBasePower: 10,
                minAetherCost: 4,
                maxAetherCost: 6,
                description: 'Light attack skills - quick, low power strikes',
                isActive: true
            },
            {
                skillType: 'attack',
                skillSubtype: 'standard',
                minBasePower: 11,
                maxBasePower: 16,
                minAetherCost: 7,
                maxAetherCost: 10,
                description: 'Standard attack skills - balanced power and cost',
                isActive: true
            },
            {
                skillType: 'attack',
                skillSubtype: 'heavy',
                minBasePower: 17,
                maxBasePower: 24,
                minAetherCost: 12,
                maxAetherCost: 18,
                description: 'Heavy attack skills - high power, high cost',
                isActive: true
            },

            // Defence Skills
            {
                skillType: 'defence',
                skillSubtype: 'light',
                minBasePower: 8,
                maxBasePower: 12,
                minAetherCost: 6,
                maxAetherCost: 12,
                description: 'Light defence skills - basic damage reduction',
                isActive: true
            },
            {
                skillType: 'defence',
                skillSubtype: 'standard',
                minBasePower: 13,
                maxBasePower: 18,
                minAetherCost: 6,
                maxAetherCost: 12,
                description: 'Standard defence skills - moderate damage reduction',
                isActive: true
            },
            {
                skillType: 'defence',
                skillSubtype: 'heavy',
                minBasePower: 19,
                maxBasePower: 26,
                minAetherCost: 6,
                maxAetherCost: 12,
                description: 'Heavy defence skills - high damage reduction',
                isActive: true
            },

            // Counter Skills
            {
                skillType: 'counter',
                skillSubtype: 'light',
                minBasePower: 10,
                maxBasePower: 14,
                minAetherCost: 8,
                maxAetherCost: 14,
                description: 'Light counter skills - basic counter-attack',
                isActive: true
            },
            {
                skillType: 'counter',
                skillSubtype: 'standard',
                minBasePower: 15,
                maxBasePower: 22,
                minAetherCost: 8,
                maxAetherCost: 14,
                description: 'Standard counter skills - moderate counter-attack',
                isActive: true
            },
            {
                skillType: 'counter',
                skillSubtype: 'perfect',
                minBasePower: 23,
                maxBasePower: 30,
                minAetherCost: 8,
                maxAetherCost: 14,
                description: 'Perfect counter skills - maximum counter-attack damage',
                isActive: true
            },

            // Buff/Debuff Skills
            {
                skillType: 'buff_debuff',
                skillSubtype: 'standard',
                minBasePower: 0,
                maxBasePower: 20,
                minAetherCost: 6,
                maxAetherCost: 14,
                description: 'Buff and debuff skills - effect scales with CON stat',
                isActive: true
            },

            // Healing Skills
            {
                skillType: 'healing',
                skillSubtype: 'standard',
                minBasePower: 0,
                maxBasePower: 30,
                minAetherCost: 10,
                maxAetherCost: 18,
                description: 'Healing skills - amount scales with skill power',
                isActive: true
            }
        ];

        const createdRules = [];
        for (const ruleData of defaultRules) {
            try {
                const existing = await this.getRuleByTypeAndSubtype(ruleData.skillType, ruleData.skillSubtype);
                if (!existing) {
                    const created = await this.createRule(ruleData);
                    createdRules.push(created);
                }
            } catch (error) {
                console.log(`Rule for ${ruleData.skillType}/${ruleData.skillSubtype} already exists, skipping...`);
            }
        }

        return {
            createdRules: createdRules.length,
            rules: createdRules
        };
    }

    /**
     * Validate a skill against its validation rule
     * @param {string} skillType - Skill type
     * @param {string} skillSubtype - Skill subtype
     * @param {number} basePower - Base power to validate
     * @param {number} aetherCost - Aether cost to validate
     * @returns {Promise<Object>} Validation result with isValid flag and errors array
     */
    async validateSkill(skillType, skillSubtype, basePower, aetherCost) {
        const rule = await this.getRuleByTypeAndSubtype(skillType, skillSubtype);

        if (!rule) {
            return {
                isValid: true,
                warnings: [`No validation rule found for ${skillType}/${skillSubtype}`]
            };
        }

        if (!rule.isActive) {
            return {
                isValid: true,
                warnings: [`Validation rule for ${skillType}/${skillSubtype} is inactive`]
            };
        }

        const errors = [];

        if (basePower < rule.minBasePower || basePower > rule.maxBasePower) {
            errors.push(
                `BasePower ${basePower} is outside valid range [${rule.minBasePower}-${rule.maxBasePower}] for ${skillType}/${skillSubtype}`
            );
        }

        if (aetherCost < rule.minAetherCost || aetherCost > rule.maxAetherCost) {
            errors.push(
                `Aether cost ${aetherCost} is outside valid range [${rule.minAetherCost}-${rule.maxAetherCost}] for ${skillType}/${skillSubtype}`
            );
        }

        return {
            isValid: errors.length === 0,
            errors,
            rule
        };
    }
}
