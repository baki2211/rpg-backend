import { CombatConstantService } from '../services/CombatConstantService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const combatConstantService = new CombatConstantService();

export class CombatConstantController {
    static getAllCombatConstants = asyncHandler(async (req, res) => {
        const { category, activeOnly } = req.query;
        res.json(await combatConstantService.getAllCombatConstants(
            category || null,
            activeOnly === 'true'
        ));
    });

    static getConstantsByCategory = asyncHandler(async (req, res) => {
        const { activeOnly } = req.query;
        res.json(await combatConstantService.getConstantsByCategory(activeOnly !== 'false'));
    });

    static getCombatConstantById = asyncHandler(async (req, res) => {
        res.json(await combatConstantService.getCombatConstantById(InputValidator.validateId(req.params.id)));
    });

    static createCombatConstant = asyncHandler(async (req, res) => {
        res.status(201).json(await combatConstantService.createCombatConstant(req.body));
    });

    static updateCombatConstant = asyncHandler(async (req, res) => {
        res.json(await combatConstantService.updateCombatConstant(InputValidator.validateId(req.params.id), req.body));
    });

    static deleteCombatConstant = asyncHandler(async (req, res) => {
        await combatConstantService.deleteCombatConstant(InputValidator.validateId(req.params.id));
        res.json({ message: 'Combat constant deleted successfully' });
    });

    static initializeDefaultConstants = asyncHandler(async (req, res) => {
        const result = await combatConstantService.initializeDefaultConstants();
        res.json({
            message: 'Combat constants initialized successfully',
            createdConstants: result.createdConstants,
            constants: result.constants
        });
    });
}
