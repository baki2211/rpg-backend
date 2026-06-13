import { SkillValidationRuleService } from '../services/SkillValidationRuleService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const ruleService = new SkillValidationRuleService();

export class SkillValidationRuleController {
    static getAllRules = asyncHandler(async (req, res) => {
        const { skillType, activeOnly } = req.query;
        res.json(await ruleService.getAllRules(skillType || null, activeOnly === 'true'));
    });

    static getRulesByCategory = asyncHandler(async (req, res) => {
        const { activeOnly } = req.query;
        res.json(await ruleService.getRulesByCategory(activeOnly !== 'false'));
    });

    static getRuleById = asyncHandler(async (req, res) => {
        res.json(await ruleService.getRuleById(parseInt(req.params.id)));
    });

    static getRuleByTypeAndSubtype = asyncHandler(async (req, res) => {
        const { skillType, skillSubtype } = req.params;
        const rule = await ruleService.getRuleByTypeAndSubtype(skillType, skillSubtype);
        if (!rule) throw new HttpError(404, 'Skill validation rule not found');
        res.json(rule);
    });

    static createRule = asyncHandler(async (req, res) => {
        res.status(201).json(await ruleService.createRule(req.body));
    });

    static updateRule = asyncHandler(async (req, res) => {
        res.json(await ruleService.updateRule(parseInt(req.params.id), req.body));
    });

    static deleteRule = asyncHandler(async (req, res) => {
        await ruleService.deleteRule(parseInt(req.params.id));
        res.json({ message: 'Skill validation rule deleted successfully' });
    });

    static initializeDefaultRules = asyncHandler(async (req, res) => {
        const result = await ruleService.initializeDefaultRules();
        res.json({
            message: 'Skill validation rules initialized successfully',
            createdRules: result.createdRules,
            rules: result.rules
        });
    });

    static validateSkill = asyncHandler(async (req, res) => {
        const { skillType, skillSubtype, basePower, aetherCost } = req.body;
        res.json(await ruleService.validateSkill(skillType, skillSubtype, basePower, aetherCost));
    });
}
