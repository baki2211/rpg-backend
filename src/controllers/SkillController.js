import { SkillService } from '../services/SkillService.js';
import { SkillEngine, ClashResult } from '../services/SkillEngine.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';

const characterRepository = AppDataSource.getRepository(Character);
const skillRepository = AppDataSource.getRepository(Skill);

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
  },

  async useSkill(req, res) {
    try {
      const { characterId, skillId, targetId, targetSkillId } = req.body;

      // Get character and skill
      const character = await characterRepository.findOne({ where: { id: characterId } });
      const skill = await skillRepository.findOne({ where: { id: skillId } });

      if (!character || !skill) {
        return res.status(404).json({ error: 'Character or skill not found' });
      }

      const skillEngine = new SkillEngine(character, skill);

      // If this is a clash (both target and targetSkill are provided)
      if (targetId && targetSkillId) {
        const target = await characterRepository.findOne({ where: { id: targetId } });
        const targetSkill = await skillRepository.findOne({ where: { id: targetSkillId } });

        if (!target || !targetSkill) {
          return res.status(404).json({ error: 'Target character or skill not found' });
        }

        const clashResult = skillEngine.resolveClash(target, targetSkill);
        
        // Apply damage to the loser
        if (clashResult.winner === 'attacker') {
          target.health -= clashResult.damage;
          await target.save();
        } else if (clashResult.winner === 'defender') {
          character.health -= clashResult.damage;
          await character.save();
        } else {
          // In case of a tie, both take damage
          character.health -= clashResult.damage;
          target.health -= clashResult.damage;
          await Promise.all([character.save(), target.save()]);
        }

        return res.json({
          message: 'Clash resolved',
          result: clashResult
        });
      }

      // If this is a regular skill use
      try {
        await skillEngine.applyCost(skill);
        const output = skillEngine.computeFinalOutput();

        return res.json({
          message: 'Skill used successfully',
          output: output,
          remainingAether: character.aether
        });
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    } catch (error) {
      console.error('Error using skill:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}; 