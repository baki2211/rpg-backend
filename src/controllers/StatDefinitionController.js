import { StatDefinitionService } from '../services/StatDefinitionService.js';

export class StatDefinitionController {
    constructor() {
        this.statDefinitionService = new StatDefinitionService();
    }

    /**
     * Get all stat definitions
     */
    async getAllStatDefinitions(req, res) {
        try {
            const { category, activeOnly } = req.query;
            const stats = await this.statDefinitionService.getAllStatDefinitions(
                category || null, 
                activeOnly === 'true'
            );
            res.json(stats);
        } catch (error) {
            console.error('Error in getAllStatDefinitions:', error);
            res.status(500).json({ error: 'Failed to retrieve stat definitions' });
        }
    }

    /**
     * Get stats organized by category
     */
    async getStatsByCategory(req, res) {
        try {
            const { activeOnly } = req.query;
            const stats = await this.statDefinitionService.getStatsByCategory(
                activeOnly !== 'false' // Default to true
            );
            res.json(stats);
        } catch (error) {
            console.error('Error in getStatsByCategory:', error);
            res.status(500).json({ error: 'Failed to retrieve stats by category' });
        }
    }

    /**
     * Get stat definition by ID
     */
    async getStatDefinitionById(req, res) {
        try {
            const { id } = req.params;
            const stat = await this.statDefinitionService.getStatDefinitionById(parseInt(id));
            
            if (!stat) {
                return res.status(404).json({ error: 'Stat definition not found' });
            }
            
            res.json(stat);
        } catch (error) {
            console.error('Error in getStatDefinitionById:', error);
            res.status(500).json({ error: 'Failed to retrieve stat definition' });
        }
    }

    /**
     * Create a new stat definition
     */
    async createStatDefinition(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const statData = req.body;
            const stat = await this.statDefinitionService.createStatDefinition(statData);
            res.status(201).json(stat);
        } catch (error) {
            console.error('Error in createStatDefinition:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a stat definition
     */
    async updateStatDefinition(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const updateData = req.body;
            
            const stat = await this.statDefinitionService.updateStatDefinition(
                parseInt(id), 
                updateData
            );
            res.json(stat);
        } catch (error) {
            console.error('Error in updateStatDefinition:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a stat definition
     */
    async deleteStatDefinition(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const success = await this.statDefinitionService.deleteStatDefinition(parseInt(id));
            
            if (success) {
                res.json({ message: 'Stat definition deleted successfully' });
            } else {
                res.status(404).json({ error: 'Stat definition not found' });
            }
        } catch (error) {
            console.error('Error in deleteStatDefinition:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Initialize default stat definitions
     */
    async initializeDefaultStats(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const createdStats = await this.statDefinitionService.initializeDefaultStats();
            res.json({ 
                message: 'Default stats initialized successfully',
                createdStats: createdStats.length,
                stats: createdStats
            });
        } catch (error) {
            console.error('Error in initializeDefaultStats:', error);
            res.status(500).json({ error: 'Failed to initialize default stats' });
        }
    }
} 