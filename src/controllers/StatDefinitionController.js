import { StatDefinitionService } from '../services/StatDefinitionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const statDefinitionService = new StatDefinitionService();

export class StatDefinitionController {
    static getAllStatDefinitions = asyncHandler(async (req, res) => {
        const { category, activeOnly } = req.query;
        res.json(await statDefinitionService.getAllStatDefinitions(
            category || null,
            activeOnly === 'true'
        ));
    });

    static getStatsByCategory = asyncHandler(async (req, res) => {
        const { activeOnly } = req.query;
        res.json(await statDefinitionService.getStatsByCategory(activeOnly !== 'false'));
    });

    static getStatDefinitionById = asyncHandler(async (req, res) => {
        res.json(await statDefinitionService.getStatDefinitionById(parseInt(req.params.id)));
    });

    static createStatDefinition = asyncHandler(async (req, res) => {
        res.status(201).json(await statDefinitionService.createStatDefinition(req.body));
    });

    static updateStatDefinition = asyncHandler(async (req, res) => {
        res.json(await statDefinitionService.updateStatDefinition(parseInt(req.params.id), req.body));
    });

    static deleteStatDefinition = asyncHandler(async (req, res) => {
        await statDefinitionService.deleteStatDefinition(parseInt(req.params.id));
        res.json({ message: 'Stat definition deleted successfully' });
    });

    static initializeDefaultStats = asyncHandler(async (req, res) => {
        const createdStats = await statDefinitionService.initializeDefaultStats();
        res.json({
            message: 'Default stats initialized successfully',
            createdStats: createdStats.length,
            stats: createdStats
        });
    });
}
