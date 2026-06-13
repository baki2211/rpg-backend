import { AppDataSource } from '../data-source.js';
import { SkillValidationRule } from '../models/skillValidationRuleModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { HttpError } from '../utils/HttpError.js';

const VALID_SKILL_TYPES = ['attack', 'defence', 'counter', 'buff_debuff', 'healing'];

export class SkillValidationRuleService {
    constructor() {
        this.ruleRepository = AppDataSource.getRepository(SkillValidationRule);
    }

    async getAllRules(skillType = null, activeOnly = false) {
        const where = {};
        if (skillType) where.skillType = skillType;
        if (activeOnly) where.isActive = true;
        return await this.ruleRepository.find({ where });
    }

    async getRuleById(id) {
        const rule = await this.ruleRepository.findOne({ where: { id } });
        if (!rule) throw new HttpError(404, 'Skill validation rule not found');
        return rule;
    }

    async getRuleByTypeAndSubtype(skillType, skillSubtype) {
        return await this.ruleRepository.findOne({
            where: { skillType, skillSubtype }
        });
    }

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

    async createRule(ruleData) {
        if (!VALID_SKILL_TYPES.includes(ruleData.skillType)) {
            throw new HttpError(400, 'Invalid skill type. Must be one of: attack, defence, counter, buff_debuff, healing');
        }

        const existing = await this.getRuleByTypeAndSubtype(ruleData.skillType, ruleData.skillSubtype);
        if (existing) {
            throw new HttpError(409, 'A validation rule for this skill type and subtype already exists');
        }

        if (ruleData.maxBasePower < ruleData.minBasePower) {
            throw new HttpError(400, 'Maximum base power cannot be less than minimum base power');
        }
        if (ruleData.maxAetherCost < ruleData.minAetherCost) {
            throw new HttpError(400, 'Maximum aether cost cannot be less than minimum aether cost');
        }

        const rule = this.ruleRepository.create(ruleData);
        const savedRule = await this.ruleRepository.save(rule);
        staticDataCache.clearEntity('SkillValidationRule');
        return savedRule;
    }

    async updateRule(id, updateData) {
        const rule = await this.ruleRepository.findOne({ where: { id } });
        if (!rule) {
            throw new HttpError(404, 'Skill validation rule not found');
        }

        const minBasePower = updateData.minBasePower !== undefined ? updateData.minBasePower : rule.minBasePower;
        const maxBasePower = updateData.maxBasePower !== undefined ? updateData.maxBasePower : rule.maxBasePower;
        const minAetherCost = updateData.minAetherCost !== undefined ? updateData.minAetherCost : rule.minAetherCost;
        const maxAetherCost = updateData.maxAetherCost !== undefined ? updateData.maxAetherCost : rule.maxAetherCost;

        if (maxBasePower < minBasePower) {
            throw new HttpError(400, 'Maximum base power cannot be less than minimum base power');
        }
        if (maxAetherCost < minAetherCost) {
            throw new HttpError(400, 'Maximum aether cost cannot be less than minimum aether cost');
        }

        await this.ruleRepository.update(id, updateData);
        staticDataCache.clearEntity('SkillValidationRule');
        return await this.ruleRepository.findOne({ where: { id } });
    }

    async deleteRule(id) {
        const result = await this.ruleRepository.delete(id);
        if (!result.affected) {
            throw new HttpError(404, 'Skill validation rule not found');
        }
        staticDataCache.clearEntity('SkillValidationRule');
    }

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
            const existing = await this.getRuleByTypeAndSubtype(ruleData.skillType, ruleData.skillSubtype);
            if (!existing) {
                createdRules.push(await this.createRule(ruleData));
            }
        }

        return {
            createdRules: createdRules.length,
            rules: createdRules
        };
    }

    async validateSkill(skillType, skillSubtype, basePower, aetherCost) {
        if (!skillType || !skillSubtype || basePower === undefined || aetherCost === undefined) {
            throw new HttpError(400, 'Missing required fields: skillType, skillSubtype, basePower, aetherCost');
        }

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
