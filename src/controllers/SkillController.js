import { SkillService } from '../services/SkillService.js';
import { SkillEngine, ClashResult } from '../services/SkillEngine.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const characterRepository = AppDataSource.getRepository(Character);
const skillRepository = AppDataSource.getRepository(Skill);

export const SkillController = {
  getAllSkills: asyncHandler(async (req, res) => {
    res.json(await SkillService.getAllSkills());
  }),

  getSkillById: asyncHandler(async (req, res) => {
    res.json(await SkillService.getSkillById(req.params.id));
  }),

  createSkill: asyncHandler(async (req, res) => {
    res.status(201).json(await SkillService.createSkill(req.body));
  }),

  updateSkill: asyncHandler(async (req, res) => {
    res.json(await SkillService.updateSkill(req.params.id, req.body));
  }),

  deleteSkill: asyncHandler(async (req, res) => {
    await SkillService.deleteSkill(req.params.id);
    res.status(204).end();
  }),

  useSkill: asyncHandler(async (req, res) => {
    const { characterId, skillId, targetId, targetSkillId } = req.body;

    const character = await characterRepository.findOne({ where: { id: characterId } });
    const skill = await skillRepository.findOne({ where: { id: skillId } });

    if (!character || !skill) {
      throw new HttpError(404, 'Character or skill not found');
    }

    const skillEngine = new SkillEngine(character, skill);

    if (targetId && targetSkillId) {
      const target = await characterRepository.findOne({ where: { id: targetId } });
      const targetSkill = await skillRepository.findOne({ where: { id: targetSkillId } });

      if (!target || !targetSkill) {
        throw new HttpError(404, 'Target character or skill not found');
      }

      const clashResult = skillEngine.resolveClash(target, targetSkill);

      if (clashResult.winner === 'attacker') {
        target.health -= clashResult.damage;
        await target.save();
      } else if (clashResult.winner === 'defender') {
        character.health -= clashResult.damage;
        await character.save();
      } else {
        character.health -= clashResult.damage;
        target.health -= clashResult.damage;
        await Promise.all([character.save(), target.save()]);
      }

      return res.json({
        message: 'Clash resolved',
        result: clashResult
      });
    }

    await skillEngine.applyCost(skill);
    const output = skillEngine.computeFinalOutput();

    res.json({
      message: 'Skill used successfully',
      output: output,
      remainingAether: character.aether
    });
  })
};
