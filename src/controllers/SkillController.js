import { SkillService } from '../services/SkillService.js';
import { SkillEngine, ClashResult } from '../services/SkillEngine.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { applyClashDamage } from '../domain/combat/clashDamage.js';

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
    const skill = await skillRepository.findOne({ where: { id: skillId }, relations: { type: true } });

    if (!character || !skill) {
      throw new HttpError(404, 'Character or skill not found');
    }

    const skillEngine = new SkillEngine(character, skill);

    if (targetId && targetSkillId) {
      const target = await characterRepository.findOne({ where: { id: targetId } });
      const targetSkill = await skillRepository.findOne({ where: { id: targetSkillId }, relations: { type: true } });

      if (!target || !targetSkill) {
        throw new HttpError(404, 'Target character or skill not found');
      }

      const clashResult = await skillEngine.resolveClash(target, targetSkill);
      const { attackerStats, defenderStats } = applyClashDamage(character.stats, target.stats, clashResult.damage);

      await AppDataSource.transaction(async (manager) => {
        await manager.update(Character, character.id, { stats: attackerStats });
        await manager.update(Character, target.id, { stats: defenderStats });
      });

      return res.json({
        message: 'Clash resolved',
        result: clashResult
      });
    }

    await skillEngine.applyCost(skill);
    const output = await skillEngine.computeFinalOutput();

    res.json({
      message: 'Skill used successfully',
      output: output,
      remainingAether: character.stats.aether
    });
  })
};
