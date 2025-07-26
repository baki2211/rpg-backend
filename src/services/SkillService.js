import { AppDataSource } from '../data-source.js';
import { Skill } from '../models/skillModel.js';
import staticDataCache from '../utils/staticDataCache.js';

const skillRepository = AppDataSource.getRepository(Skill);

export const SkillService = {
  async getAllSkills() {
    return await staticDataCache.getSkills(true);
  },

  async getSkillById(id) {
    return await staticDataCache.getSkillById(id, true);
  },

  async createSkill(skillData) {
    // Validate skillPointCost
    if (typeof skillData.skillPointCost !== 'number' || skillData.skillPointCost < 1) {
      throw new Error('Skill point cost must be a positive number');
    }

    // Validate target field
    if (skillData.target && !['self', 'other', 'none', 'any'].includes(skillData.target)) {
      throw new Error('Target must be one of: self, other, none, any');
    }

    const skill = skillRepository.create(skillData);
    const savedSkill = await skillRepository.save(skill);
    staticDataCache.clearEntity('Skill');
    return savedSkill;
  },

  async updateSkill(id, skillData) {
    // Validate skillPointCost if it's being updated
    if (skillData.skillPointCost !== undefined) {
      if (typeof skillData.skillPointCost !== 'number' || skillData.skillPointCost < 1) {
        throw new Error('Skill point cost must be a positive number');
      }
    }

    // Validate target field if it's being updated
    if (skillData.target !== undefined && !['self', 'other', 'none', 'any'].includes(skillData.target)) {
      throw new Error('Target must be one of: self, other, none, any');
    }

    await skillRepository.update(id, skillData);
    staticDataCache.clearEntity('Skill');
    return await skillRepository.findOne({ where: { id }, relations: ['branch', 'type'] });
  },

  async deleteSkill(id) {
    const skill = await skillRepository.findOne({ where: { id } });
    if (skill) {
      await skillRepository.remove(skill);
      staticDataCache.clearEntity('Skill');
      return true;
    }
    return false;
  }
}; 