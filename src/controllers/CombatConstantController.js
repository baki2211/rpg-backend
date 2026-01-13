import { CombatConstantService } from '../services/CombatConstantService.js';

export class CombatConstantController {
    constructor() {
        this.combatConstantService = new CombatConstantService();
    }

    /**
     * Get all combat constants
     * Query params: category, activeOnly
     */
    async getAllCombatConstants(req, res) {
        try {
            const { category, activeOnly } = req.query;
            const constants = await this.combatConstantService.getAllCombatConstants(
                category || null,
                activeOnly === 'true'
            );
            res.json(constants);
        } catch (error) {
            console.error('Error in getAllCombatConstants:', error);
            res.status(500).json({ error: 'Failed to retrieve combat constants' });
        }
    }

    /**
     * Get constants organized by category
     * Query params: activeOnly
     */
    async getConstantsByCategory(req, res) {
        try {
            const { activeOnly } = req.query;
            const constants = await this.combatConstantService.getConstantsByCategory(
                activeOnly !== 'false' // Default to true
            );
            res.json(constants);
        } catch (error) {
            console.error('Error in getConstantsByCategory:', error);
            res.status(500).json({ error: 'Failed to retrieve constants by category' });
        }
    }

    /**
     * Get combat constant by ID
     */
    async getCombatConstantById(req, res) {
        try {
            const { id } = req.params;
            const constant = await this.combatConstantService.getCombatConstantById(parseInt(id));

            if (!constant) {
                return res.status(404).json({ error: 'Combat constant not found' });
            }

            res.json(constant);
        } catch (error) {
            console.error('Error in getCombatConstantById:', error);
            res.status(500).json({ error: 'Failed to retrieve combat constant' });
        }
    }

    /**
     * Create a new combat constant (admin only)
     */
    async createCombatConstant(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const constantData = req.body;
            const constant = await this.combatConstantService.createCombatConstant(constantData);
            res.status(201).json(constant);
        } catch (error) {
            console.error('Error in createCombatConstant:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Update a combat constant's value (admin only)
     */
    async updateCombatConstant(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const updateData = req.body;

            const constant = await this.combatConstantService.updateCombatConstant(
                parseInt(id),
                updateData
            );

            res.json({
                id: constant.id,
                constantKey: constant.constantKey,
                value: constant.value,
                message: 'Combat constant updated successfully'
            });
        } catch (error) {
            console.error('Error in updateCombatConstant:', error);
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: error.message });
            }
            if (error.message.includes('must be at least') || error.message.includes('must be at most')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Delete a combat constant (admin only)
     */
    async deleteCombatConstant(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { id } = req.params;
            const success = await this.combatConstantService.deleteCombatConstant(parseInt(id));

            if (success) {
                res.json({ message: 'Combat constant deleted successfully' });
            } else {
                res.status(404).json({ error: 'Combat constant not found' });
            }
        } catch (error) {
            console.error('Error in deleteCombatConstant:', error);
            res.status(400).json({ error: error.message });
        }
    }

    /**
     * Initialize default combat constants (admin only)
     */
    async initializeDefaultConstants(req, res) {
        try {
            // Verify user has admin permissions
            if (!['admin'].includes(req.user.role)) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await this.combatConstantService.initializeDefaultConstants();
            res.json({
                createdConstants: result.createdConstants,
                message: 'Combat constants initialized successfully',
                constants: result.constants
            });
        } catch (error) {
            console.error('Error in initializeDefaultConstants:', error);
            res.status(500).json({ error: 'Failed to initialize default constants' });
        }
    }
}
