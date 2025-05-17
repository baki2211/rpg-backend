import { SkillTypeService } from '../services/SkillTypeService.js';

export const SkillTypeController = {
  async getAllSkillTypes(req, res) {
    try {
      const types = await SkillTypeService.getAllSkillTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getSkillTypeById(req, res) {
    try {
      const type = await SkillTypeService.getSkillTypeById(req.params.id);
      if (!type) {
        return res.status(404).json({ message: 'Skill type not found' });
      }
      res.json(type);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createSkillType(req, res) {
    try {
      const type = await SkillTypeService.createSkillType(req.body);
      res.status(201).json(type);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateSkillType(req, res) {
    try {
      const type = await SkillTypeService.updateSkillType(req.params.id, req.body);
      if (!type) {
        return res.status(404).json({ message: 'Skill type not found' });
      }
      res.json(type);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async deleteSkillType(req, res) {
    try {
      const success = await SkillTypeService.deleteSkillType(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Skill type not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}; 