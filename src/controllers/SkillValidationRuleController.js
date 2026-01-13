import { SkillValidationRuleService } from '../services/SkillValidationRuleService.js';

export class SkillValidationRuleController {
    constructor() {
        this.ruleService = new SkillValidationRuleService();
    }

    /**
     * Get all skill validation rules
     * Query params: skillType, activeOnly
     */
    async getAllRules(req, res) {
        try {
            const { skillType, activeOnly } = req.query;
            const rules = await this.ruleService.getAllRules(
                skillType || null,
                activeOnly === 'true'
            );
            res.json(rules);
        } catch (error) {
            console.error('Error in getAllRules:', error);
            res.status(500).json({ error: 'Failed to retrieve skill validation rules' });
        }
    }

    /**
     * Get rules organized by category (skill type)
     * Query params: activeOnly
     */
    async getRulesByCategory(req, res) {
        try {
            const { activeOnly } = req.query;
            const rules = await this.ruleService.getRulesByCategory(
                activeOnly !== 'false' // Default to true
            );
            res.json(rules);
        } catch (error) {
            console.error('Error in getRulesByCategory:', error);
            res.status(500).json({ error: 'Failed to retrieve rules by category' });
        }
    }

    /**
     * Get skill validation rule by ID
     */
    async getRuleById(req, res) {
        try {
            const { id } = req.params;
            const rule = await this.ruleService.getRuleById(parseInt(id));

            if (!rule) {
                return res.status(404).json({ error: 'Skill validation rule not found' });
            }

            res.json(rule);
        } catch (error) {
            console.error('Error in getRuleById:', error);
            res.status(500).json({ error: 'Failed to retrieve skill validation rule' });
        }
    }

    /**
     * Get skill validation rule by type and subtype
     */
    async getRuleByTypeAndSubtype(req, res) {
        try {
            const { skillType, skillSubtype } = req.params;
            const rule = await this.ruleService.getRuleByTypeAndSubtype(skillType, skillSubtype);

            if (!rule) {
                return res.status(404).json({ error: 'Skill validation rule not found' });
            }

            res.json(rule);
        } catch (error) {
            console.error('Error in getRuleByTypeAndSubtype:', error);
            res.status(500).json({ error: 'Failed to retrieve skill validation rule' });
        }
    }

    /**
     * Create a new skill validation rule (admin only)
     */
    async createRule(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const ruleData = req.body;
            const rule = await this.ruleService.createRule(ruleData);
            res.status(201).json(rule);
        } catch (error) {
            console.error('Error in createRule:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a skill validation rule (admin only)
     */
    async updateRule(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const updateData = req.body;

            const rule = await this.ruleService.updateRule(
                parseInt(id),
                updateData
            );

            res.json({
                id: rule.id,
                skillType: rule.skillType,
                skillSubtype: rule.skillSubtype,
                message: 'Skill validation rule updated successfully'
            });
        } catch (error) {
            console.error('Error in updateRule:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: error.message });
            }
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a skill validation rule (admin only)
     */
    async deleteRule(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const success = await this.ruleService.deleteRule(parseInt(id));

            if (success) {
                res.json({ message: 'Skill validation rule deleted successfully' });
            } else {
                res.status(404).json({ error: 'Skill validation rule not found' });
            }
        } catch (error) {
            console.error('Error in deleteRule:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Initialize default skill validation rules (admin only)
     */
    async initializeDefaultRules(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await this.ruleService.initializeDefaultRules();
            res.json({
                createdRules: result.createdRules,
                message: 'Skill validation rules initialized successfully',
                rules: result.rules
            });
        } catch (error) {
            console.error('Error in initializeDefaultRules:', error);
            res.status(500).json({ error: 'Failed to initialize default rules' });
        }
    }

    /**
     * Validate a skill against validation rules
     * POST body: { skillType, skillSubtype, basePower, aetherCost }
     */
    async validateSkill(req, res) {
        try {
            const { skillType, skillSubtype, basePower, aetherCost } = req.body;

            if (!skillType || !skillSubtype || basePower === undefined || aetherCost === undefined) {
                return res.status(400).json({
                    error: 'Missing required fields: skillType, skillSubtype, basePower, aetherCost'
                });
            }

            const result = await this.ruleService.validateSkill(
                skillType,
                skillSubtype,
                basePower,
                aetherCost
            );

            res.json(result);
        } catch (error) {
            console.error('Error in validateSkill:', error);
            res.status(500).json({ error: 'Failed to validate skill' });
        }
    }
}
