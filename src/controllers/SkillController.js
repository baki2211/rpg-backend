import { SkillService } from '../services/SkillService.js';

export const SkillController = {
  async getAllSkills(req, res) {
    try {
      const skills = await SkillService.getAllSkills();
      res.json(skills);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSkillById(req, res) {
    try {
      const skill = await SkillService.getSkillById(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: 'Skill not found' });
      }
      res.json(skill);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createSkill(req, res) {
    try {
      const skill = await SkillService.createSkill(req.body);
      res.status(201).json(skill);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateSkill(req, res) {
    try {
      const skill = await SkillService.updateSkill(req.params.id, req.body);
      if (!skill) {
        return res.status(404).json({ message: 'Skill not found' });
      }
      res.json(skill);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteSkill(req, res) {
    try {
      const success = await SkillService.deleteSkill(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Skill not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}; 