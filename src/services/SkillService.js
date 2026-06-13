import { AppDataSource } from '../data-source.js';
import { Skill } from '../models/skillModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { HttpError } from '../utils/HttpError.js';

const skillRepository = AppDataSource.getRepository(Skill);

const VALID_TARGETS = ['self', 'other', 'none', 'any'];

const validateSkillData = (skillData, partial = false) => {
  if (!partial || skillData.skillPointCost !== undefined) {
    if (typeof skillData.skillPointCost !== 'number' || skillData.skillPointCost < 1) {
      throw new HttpError(400, 'Skill point cost must be a positive number');
    }
  }
  if (skillData.target !== undefined && !VALID_TARGETS.includes(skillData.target)) {
    throw new HttpError(400, 'Target must be one of: self, other, none, any');
  }
};

export const SkillService = {
  async getAllSkills() {
    return await staticDataCache.getSkills(true);
  },

  async getSkillById(id) {
    const skill = await staticDataCache.getSkillById(id, true);
    if (!skill) throw new HttpError(404, 'Skill not found');
    return skill;
  },

  async createSkill(skillData) {
    validateSkillData(skillData);
    const skill = skillRepository.create(skillData);
    const savedSkill = await skillRepository.save(skill);
    staticDataCache.clearEntity('Skill');
    return savedSkill;
  },

  async updateSkill(id, skillData) {
    validateSkillData(skillData, true);
    await skillRepository.update(id, skillData);
    staticDataCache.clearEntity('Skill');
    const skill = await skillRepository.findOne({ where: { id }, relations: ['branch', 'type'] });
    if (!skill) throw new HttpError(404, 'Skill not found');
    return skill;
  },

  async deleteSkill(id) {
    const skill = await skillRepository.findOne({ where: { id } });
    if (!skill) throw new HttpError(404, 'Skill not found');
    await skillRepository.remove(skill);
    staticDataCache.clearEntity('Skill');
  }
};
