import { AppDataSource } from '../data-source.js';
import { StatDefinition } from '../models/statDefinitionModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { HttpError } from '../utils/HttpError.js';

const VALID_CATEGORIES = ['primary_stat', 'resource', 'scaling_stat'];
const INTERNAL_NAME_PATTERN = /^[a-z0-9_]+$/;

export class StatDefinitionService {
    constructor() {
        this.statDefinitionRepository = AppDataSource.getRepository(StatDefinition);
    }

    async getAllStatDefinitions(category = null, activeOnly = false) {
        const allStats = await staticDataCache.getStatDefinitions(category, activeOnly);
        return allStats.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            return a.displayName.localeCompare(b.displayName);
        });
    }

    async getStatDefinitionById(id) {
        const stat = await this.statDefinitionRepository.findOne({ where: { id } });
        if (!stat) throw new HttpError(404, 'Stat definition not found');
        return stat;
    }

    async getStatDefinitionByInternalName(internalName) {
        return await this.statDefinitionRepository.findOne({ where: { internalName } });
    }

    async createStatDefinition(statData) {
        if (!VALID_CATEGORIES.includes(statData.category)) {
            throw new HttpError(400, 'Invalid category. Must be one of: primary_stat, resource, scaling_stat');
        }

        if (!INTERNAL_NAME_PATTERN.test(statData.internalName)) {
            throw new HttpError(400, 'Internal name must contain only lowercase letters, numbers, and underscores');
        }

        const existing = await this.getStatDefinitionByInternalName(statData.internalName);
        if (existing) {
            throw new HttpError(409, 'A stat with this internal name already exists');
        }

        if (statData.maxValue === null || statData.maxValue === undefined) {
            statData.maxValue = 100;
        }

        if (statData.maxValue !== null && statData.maxValue < statData.minValue) {
            throw new HttpError(400, 'Maximum value cannot be less than minimum value');
        }

        const statDefinition = this.statDefinitionRepository.create(statData);
        const savedStat = await this.statDefinitionRepository.save(statDefinition);
        staticDataCache.clearEntity('StatDefinition');
        return savedStat;
    }

    async updateStatDefinition(id, updateData) {
        const statDefinition = await this.statDefinitionRepository.findOne({ where: { id } });
        if (!statDefinition) {
            throw new HttpError(404, 'Stat definition not found');
        }

        if (updateData.category && !VALID_CATEGORIES.includes(updateData.category)) {
            throw new HttpError(400, 'Invalid category. Must be one of: primary_stat, resource, scaling_stat');
        }

        if (updateData.internalName) {
            if (!INTERNAL_NAME_PATTERN.test(updateData.internalName)) {
                throw new HttpError(400, 'Internal name must contain only lowercase letters, numbers, and underscores');
            }

            const existing = await this.statDefinitionRepository.findOne({
                where: { internalName: updateData.internalName }
            });
            if (existing && existing.id !== id) {
                throw new HttpError(409, 'A stat with this internal name already exists');
            }
        }

        if (updateData.hasOwnProperty('maxValue') && (updateData.maxValue === null || updateData.maxValue === undefined)) {
            updateData.maxValue = 100;
        }

        const minValue = updateData.minValue !== undefined ? updateData.minValue : statDefinition.minValue;
        const maxValue = updateData.maxValue !== undefined ? updateData.maxValue : statDefinition.maxValue;

        if (maxValue !== null && maxValue < minValue) {
            throw new HttpError(400, 'Maximum value cannot be less than minimum value');
        }

        await this.statDefinitionRepository.update(id, updateData);
        staticDataCache.clearEntity('StatDefinition');
        return await this.statDefinitionRepository.findOne({ where: { id } });
    }

    async deleteStatDefinition(id) {
        const result = await this.statDefinitionRepository.delete(id);
        if (!result.affected) {
            throw new HttpError(404, 'Stat definition not found');
        }
        staticDataCache.clearEntity('StatDefinition');
    }

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

    async initializeDefaultStats() {
        const defaultStats = [
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
            const existing = await this.getStatDefinitionByInternalName(stat.internalName);
            if (!existing) {
                createdStats.push(await this.createStatDefinition(stat));
            }
        }

        return createdStats;
    }
}
