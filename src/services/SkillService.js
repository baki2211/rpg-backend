import { AppDataSource } from '../data-source.js';
import { Skill } from '../models/skillModel.js';

const skillRepository = AppDataSource.getRepository(Skill);

export const SkillService = {
  async getAllSkills() {
    return await skillRepository.find();
  },

  async getSkillById(id) {
    return await skillRepository.findOne({ where: { id } });
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
    return await skillRepository.save(skill);
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
    return await skillRepository.findOne({ where: { id } });
  },

  async deleteSkill(id) {
    const skill = await skillRepository.findOne({ where: { id } });
    if (skill) {
      await skillRepository.remove(skill);
      return true;
    }
    return false;
  }
}; 