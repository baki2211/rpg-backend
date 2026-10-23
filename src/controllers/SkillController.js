import { SkillService } from '../services/SkillService.js';
import { SkillEngine } from '../services/SkillEngine.js';
import { PvPResolutionService } from '../services/PvPResolutionService.js';
import { SkillUsageService } from '../services/SkillUsageService.js';
import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';
import { applyClashDamage } from '../domain/combat/clashDamage.js';
import { rollD20 } from '../utils/dice.js';
import { lockCharacter, lockCharacters } from '../utils/rowLocks.js';

const characterRepository = AppDataSource.getRepository(Character);
const skillRepository = AppDataSource.getRepository(Skill);
const characterSkillRepository = AppDataSource.getRepository(CharacterSkill);

const isPresent = (raw) => raw != null && raw !== '';

// Body ids must be positive integers; anything else is a 400 (TypeORM 1.0 throws on undefined in `where`)
const parseId = (raw) => {
  const id = Number(raw);
  return isPresent(raw) && Number.isInteger(id) && id > 0 ? id : null;
};

export const SkillController = {
  getAllSkills: asyncHandler(async (req, res) => {
    res.json(await SkillService.getAllSkills());
  }),

  getSkillById: asyncHandler(async (req, res) => {
    res.json(await SkillService.getSkillById(InputValidator.validateId(req.params.id)));
  }),

  createSkill: asyncHandler(async (req, res) => {
    res.status(201).json(await SkillService.createSkill(req.body));
  }),

  updateSkill: asyncHandler(async (req, res) => {
    res.json(await SkillService.updateSkill(InputValidator.validateId(req.params.id), req.body));
  }),

  deleteSkill: asyncHandler(async (req, res) => {
    await SkillService.deleteSkill(InputValidator.validateId(req.params.id));
    res.status(204).end();
  }),

  useSkill: asyncHandler(async (req, res) => {
    const characterId = parseId(req.body.characterId);
    const skillId = parseId(req.body.skillId);
    const targetId = parseId(req.body.targetId);
    const targetSkillId = parseId(req.body.targetSkillId);
    if (!characterId || !skillId) {
      throw new HttpError(400, 'characterId and skillId are required');
    }
    if ((isPresent(req.body.targetId) && !targetId) || (isPresent(req.body.targetSkillId) && !targetSkillId)) {
      throw new HttpError(400, 'targetId and targetSkillId must be valid ids');
    }

    // Only the caller's own characters can use skills; someone else's character reads as not found
    const character = await characterRepository.findOne({ where: { id: characterId, userId: req.user.id } });
    const skill = await skillRepository.findOne({ where: { id: skillId }, relations: { type: true } });

    if (!character || !skill) {
      throw new HttpError(404, 'Character or skill not found');
    }
    if (!(await characterSkillRepository.existsBy({ characterId: character.id, skillId: skill.id }))) {
      throw new HttpError(403, 'Character does not have this skill');
    }

    if (targetId && targetSkillId) {
      const target = await characterRepository.findOne({ where: { id: targetId } });
      const targetSkill = await skillRepository.findOne({ where: { id: targetSkillId }, relations: { type: true } });

      if (!target || !targetSkill) {
        throw new HttpError(404, 'Target character or skill not found');
      }
      if (!(await characterSkillRepository.existsBy({ characterId: target.id, skillId: targetSkill.id }))) {
        throw new HttpError(400, 'Target does not have the specified skill');
      }

      const { winner, damage, effects } = await PvPResolutionService.resolvePvPEncounter(
        character, skill, target, targetSkill, { attacker: rollD20(), defender: rollD20() }
      );

      await AppDataSource.transaction(async (manager) => {
        // Damage lands on the current stats: both rows are locked and re-read, so a concurrent
        // write to `stats` (aether, level-up, another clash) isn't overwritten
        const locked = await lockCharacters(manager, [character.id, target.id]);
        const { attackerStats, defenderStats } = applyClashDamage(
          locked.get(character.id).stats, locked.get(target.id).stats, damage
        );
        await manager.update(Character, character.id, { stats: attackerStats });
        await manager.update(Character, target.id, { stats: defenderStats });
        // A clash is one use of each skill; counted here because the resolver no longer writes
        await SkillUsageService.incrementSkillUsages([
          { characterId: character.id, skillId: skill.id, branchId: skill.branchId },
          { characterId: target.id, skillId: targetSkill.id, branchId: targetSkill.branchId },
        ], manager);
      });

      return res.json({
        message: 'Clash resolved',
        result: { winner, damage, effects }
      });
    }

    const roll = rollD20();
    const { output, stats } = await AppDataSource.transaction(async (manager) => {
      // The cost is paid from the current stats: the row is locked and re-read inside the transaction
      const skillEngine = new SkillEngine(await lockCharacter(manager, character.id), skill);
      const stats = await skillEngine.statsAfterCost();
      const { finalOutput } = await skillEngine.computeFinalOutput(roll);

      await manager.update(Character, character.id, { stats });
      await SkillUsageService.incrementSkillUsage(character.id, skill.id, skill.branchId, manager);
      return { output: finalOutput, stats };
    });

    res.json({
      message: 'Skill used successfully',
      output: output,
      remainingAether: stats.aether
    });
  })
};
