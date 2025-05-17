import { SkillBranchService } from '../services/SkillBranchService.js';

export const SkillBranchController = {
  async getAllSkillBranches(req, res) {
    try {
      const branches = await SkillBranchService.getAllSkillBranches();
      res.json(branches);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSkillBranchById(req, res) {
    try {
      const branch = await SkillBranchService.getSkillBranchById(req.params.id);
      if (!branch) {
        return res.status(404).json({ message: 'Skill branch not found' });
      }
      res.json(branch);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createSkillBranch(req, res) {
    try {
      const branch = await SkillBranchService.createSkillBranch(req.body);
      res.status(201).json(branch);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateSkillBranch(req, res) {
    try {
      const branch = await SkillBranchService.updateSkillBranch(req.params.id, req.body);
      if (!branch) {
        return res.status(404).json({ message: 'Skill branch not found' });
      }
      res.json(branch);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteSkillBranch(req, res) {
    try {
      const success = await SkillBranchService.deleteSkillBranch(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Skill branch not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}; 