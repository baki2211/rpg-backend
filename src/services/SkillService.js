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
    const skill = skillRepository.create(skillData);
    return await skillRepository.save(skill);
  },

  async updateSkill(id, skillData) {
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