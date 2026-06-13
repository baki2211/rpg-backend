import { AppDataSource } from '../data-source.js';
import { SkillBranch } from '../models/skillBranchModel.js';
import { HttpError } from '../utils/HttpError.js';

const skillBranchRepository = AppDataSource.getRepository(SkillBranch);

export const SkillBranchService = {
    async getAllSkillBranches() {
        return await skillBranchRepository.find();
    },

    async getSkillBranchById(id) {
        const branch = await skillBranchRepository.findOne({ where: { id } });
        if (!branch) throw new HttpError(404, 'Skill branch not found');
        return branch;
    },

    async createSkillBranch(branchData) {
        const branch = skillBranchRepository.create(branchData);
        return await skillBranchRepository.save(branch);
    },

    async updateSkillBranch(id, branchData) {
        await skillBranchRepository.update(id, branchData);
        const branch = await skillBranchRepository.findOne({ where: { id } });
        if (!branch) throw new HttpError(404, 'Skill branch not found');
        return branch;
    },

    async deleteSkillBranch(id) {
        const branch = await skillBranchRepository.findOne({ where: { id } });
        if (!branch) throw new HttpError(404, 'Skill branch not found');
        await skillBranchRepository.remove(branch);
    },
};
