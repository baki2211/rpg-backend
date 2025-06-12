import { AppDataSource } from '../data-source.js';
import { StatDefinition } from '../models/statDefinitionModel.js';

export class StatDefinitionService {
    constructor() {
        this.statDefinitionRepository = AppDataSource.getRepository(StatDefinition);
    }

    /**
     * Get all stat definitions
     * @param {string} category - Optional category filter ('primary_stat', 'resource', 'scaling_stat')
     * @param {boolean} activeOnly - Only return active definitions
     * @returns {Promise<Array>} Array of stat definitions
     */
    async getAllStatDefinitions(category = null, activeOnly = false) {
        const whereCondition = {};
        
        if (category) {
            whereCondition.category = category;
        }
        
        if (activeOnly) {
            whereCondition.isActive = true;
        }

        return await this.statDefinitionRepository.find({
            where: whereCondition,
            order: { 
                category: 'ASC',
                sortOrder: 'ASC',
                displayName: 'ASC'
            }
        });
    }

    /**
     * Get stat definition by ID
     * @param {number} id - Stat definition ID
     * @returns {Promise<Object|null>} Stat definition or null
     */
    async getStatDefinitionById(id) {
        return await this.statDefinitionRepository.findOne({ where: { id } });
    }

    /**
     * Get stat definition by internal name
     * @param {string} internalName - Internal name of the stat
     * @returns {Promise<Object|null>} Stat definition or null
     */
    async getStatDefinitionByInternalName(internalName) {
        return await this.statDefinitionRepository.findOne({ where: { internalName } });
    }

    /**
     * Create a new stat definition
     * @param {Object} statData - Stat definition data
     * @returns {Promise<Object>} Created stat definition
     */
    async createStatDefinition(statData) {
        // Validate category
        const validCategories = ['primary_stat', 'resource', 'scaling_stat'];
        if (!validCategories.includes(statData.category)) {
            throw new Error('Invalid category. Must be one of: primary_stat, resource, scaling_stat');
        }

        // Validate internal name format
        if (!/^[a-z0-9_]+$/.test(statData.internalName)) {
            throw new Error('Internal name must contain only lowercase letters, numbers, and underscores');
        }

        // Check if internal name already exists
        const existing = await this.getStatDefinitionByInternalName(statData.internalName);
        if (existing) {
            throw new Error('A stat with this internal name already exists');
        }

        // Default maxValue to 100 if not provided or null
        if (statData.maxValue === null || statData.maxValue === undefined) {
            statData.maxValue = 100;
        }

        // Validate min/max values
        if (statData.maxValue !== null && statData.maxValue < statData.minValue) {
            throw new Error('Maximum value cannot be less than minimum value');
        }

        const statDefinition = this.statDefinitionRepository.create(statData);
        return await this.statDefinitionRepository.save(statDefinition);
    }

    /**
     * Update a stat definition
     * @param {number} id - Stat definition ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated stat definition
     */
    async updateStatDefinition(id, updateData) {
        const statDefinition = await this.getStatDefinitionById(id);
        if (!statDefinition) {
            throw new Error('Stat definition not found');
        }

        // Validate category if being updated
        if (updateData.category) {
            const validCategories = ['primary_stat', 'resource', 'scaling_stat'];
            if (!validCategories.includes(updateData.category)) {
                throw new Error('Invalid category. Must be one of: primary_stat, resource, scaling_stat');
            }
        }

        // Validate internal name format if being updated
        if (updateData.internalName) {
            if (!/^[a-z0-9_]+$/.test(updateData.internalName)) {
                throw new Error('Internal name must contain only lowercase letters, numbers, and underscores');
            }

            // Check if new internal name already exists (excluding current record)
            const existing = await this.statDefinitionRepository.findOne({
                where: { internalName: updateData.internalName }
            });
            if (existing && existing.id !== id) {
                throw new Error('A stat with this internal name already exists');
            }
        }

        // Default maxValue to 100 if being set to null or undefined
        if (updateData.hasOwnProperty('maxValue') && (updateData.maxValue === null || updateData.maxValue === undefined)) {
            updateData.maxValue = 100;
        }

        // Validate min/max values if being updated
        const minValue = updateData.minValue !== undefined ? updateData.minValue : statDefinition.minValue;
        const maxValue = updateData.maxValue !== undefined ? updateData.maxValue : statDefinition.maxValue;
        
        if (maxValue !== null && maxValue < minValue) {
            throw new Error('Maximum value cannot be less than minimum value');
        }

        await this.statDefinitionRepository.update(id, updateData);
        return await this.getStatDefinitionById(id);
    }

    /**
     * Delete a stat definition
     * @param {number} id - Stat definition ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteStatDefinition(id) {
        const statDefinition = await this.getStatDefinitionById(id);
        if (!statDefinition) {
            throw new Error('Stat definition not found');
        }

        // Check if this stat is being used in any characters
        // This is a safety check to prevent deletion of stats that are in use
        const result = await this.statDefinitionRepository.delete(id);
        return result.affected > 0;
    }

    /**
     * Get stats organized by category
     * @param {boolean} activeOnly - Only return active definitions
     * @returns {Promise<Object>} Stats organized by category
     */
    async getStatsByCategory(activeOnly = true) {
        const stats = await this.getAllStatDefinitions(null, activeOnly);
        
        const organized = {
            primary_stat: [],
            resource: [],
            scaling_stat: []
        };

        stats.forEach(stat => {
            if (organized[stat.category]) {
                organized[stat.category].push(stat);
            }
        });

        return organized;
    }

    /**
     * Initialize default stat definitions (for first-time setup)
     * @returns {Promise<Array>} Created stat definitions
     */
    async initializeDefaultStats() {
        const defaultStats = [
            // Primary Stats (used in character creation)
            {
                internalName: 'foc',
                displayName: 'Focus',
                description: 'Mental concentration and magical aptitude',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 1
            },
            {
                internalName: 'con',
                displayName: 'Control',
                description: 'Precision and finesse in actions',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 2
            },
            {
                internalName: 'res',
                displayName: 'Resilience',
                description: 'Physical and mental toughness',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 3
            },
            {
                internalName: 'ins',
                displayName: 'Instinct',
                description: 'Natural reflexes and intuition',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 4
            },
            {
                internalName: 'pre',
                displayName: 'Presence',
                description: 'Charisma and leadership ability',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 5
            },
            {
                internalName: 'for',
                displayName: 'Force',
                description: 'Raw physical power and strength',
                category: 'primary_stat',
                defaultValue: 5,
                maxValue: 15,
                minValue: 0,
                sortOrder: 6
            },
            
            // Resources
            {
                internalName: 'hp',
                displayName: 'Health Points',
                description: 'Physical health and vitality',
                category: 'resource',
                defaultValue: 100,
                maxValue: 500,
                minValue: 0,
                sortOrder: 1
            },
            {
                internalName: 'aether',
                displayName: 'Aether Energy',
                description: 'Magical energy used for skills',
                category: 'resource',
                defaultValue: 50,
                maxValue: 200,
                minValue: 0,
                sortOrder: 2
            }
        ];

        const createdStats = [];
        for (const stat of defaultStats) {
            try {
                // Check if it already exists
                const existing = await this.getStatDefinitionByInternalName(stat.internalName);
                if (!existing) {
                    const created = await this.createStatDefinition(stat);
                    createdStats.push(created);
                }
            } catch (error) {
                // Skip if already exists
                console.log(`Stat ${stat.internalName} already exists, skipping...`);
            }
        }

        return createdStats;
    }
} 