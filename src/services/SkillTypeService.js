import { AppDataSource } from '../data-source.js';
import { SkillType } from '../models/skillTypeModel.js';

const skillTypeRepository = AppDataSource.getRepository(SkillType);

export const SkillTypeService = {
  async getAllSkillTypes() {
    return await skillTypeRepository.find();
  },

  async getSkillTypeById(id) {
    return await skillTypeRepository.findOne({ where: { id } });
  },

  async createSkillType(typeData) {
    const type = skillTypeRepository.create(typeData);
    return await skillTypeRepository.save(type);
  },

  async updateSkillType(id, typeData) {
    await skillTypeRepository.update(id, typeData);
    return await skillTypeRepository.findOne({ where: { id } });
  },

  async deleteSkillType(id) {
    const type = await skillTypeRepository.findOne({ where: { id } });
    if (type) {
      await skillTypeRepository.remove(type);
      return true;
    }
    return false;
  }
}; 