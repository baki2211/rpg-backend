import { CharacterSkillsService } from '../services/CharacterSkillsService.js';

const characterSkillsService = new CharacterSkillsService();

export class CharacterSkillsController {
  static async getAvailableSkills(req, res) {
    try {
      const userId = req.user.id;
      const { characterId } = req.params;
      const availableSkills = await characterSkillsService.getAvailableSkills(Number(characterId), userId);
      res.status(200).json(availableSkills);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getAcquiredSkills(req, res) {
    try {
      const userId = req.user.id;
      const { characterId } = req.params;
      const acquiredSkills = await characterSkillsService.getAcquiredSkills(Number(characterId), userId);
      res.status(200).json(acquiredSkills);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async acquireSkill(req, res) {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;
      const character = await characterSkillsService.acquireSkill(Number(skillId), userId);
      res.status(200).json(character);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}