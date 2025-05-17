import { AppDataSource } from '../data-source.js';
import { SkillBranch } from '../models/skillBranchModel.js';

const skillBranchRepository = AppDataSource.getRepository(SkillBranch);

export const SkillBranchService = {
  async getAllSkillBranches() {
    return await skillBranchRepository.find();
  },

  async getSkillBranchById(id) {
    return await skillBranchRepository.findOne({ where: { id } });
  },

  async createSkillBranch(branchData) {
    const branch = skillBranchRepository.create(branchData);
    return await skillBranchRepository.save(branch);
  },

  async updateSkillBranch(id, branchData) {
    await skillBranchRepository.update(id, branchData);
    return await skillBranchRepository.findOne({ where: { id } });
  },

  async deleteSkillBranch(id) {
    const branch = await skillBranchRepository.findOne({ where: { id } });
    if (branch) {
      await skillBranchRepository.remove(branch);
      return true;
    }
    return false;
  }
}; 