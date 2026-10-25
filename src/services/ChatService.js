import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';
import { Character } from '../models/characterModel.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { SkillUsageService } from './SkillUsageService.js';
import { EngineLogService } from './EngineLogService.js';
import { SessionParticipantService } from './SessionParticipantService.js';
import { logger } from '../utils/logger.js';
import { CharacterStatsService } from './CharacterStatsService.js';
import { EventService } from './EventService.js';
import { TargetResolutionService } from './TargetResolutionService.js';
import { SkillExecutionService } from './SkillExecutionService.js';
import { HttpError, httpResponseForError } from '../utils/HttpError.js';
import { rollD20 } from '../utils/dice.js';
import staticDataCache from '../utils/staticDataCache.js';
import { evaluatePost, chatRulesFromConstants } from '../domain/chat/messageRewards.js';
import { planChatSkillUse } from '../domain/chat/skillUse.js';
import { lockCharacter } from '../utils/rowLocks.js';

const SKILL_NOT_OWNED = 'Character does not have this skill';

export class ChatService {
  chatRepository = AppDataSource.getRepository(ChatMessage);
  characterRepository = AppDataSource.getRepository(Character);
  engineLogService = new EngineLogService();
  characterStatsService = new CharacterStatsService();
  sessionParticipantService = new SessionParticipantService();
  targetResolutionService = new TargetResolutionService();
  skillExecutionService = new SkillExecutionService();

  async getMessagesByLocation(locationId) {
    // Keep messages for 5 hours as intended, but optimize memory usage
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    
    try {
      const messages = await this.chatRepository.find({
        where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
        order: { createdAt: 'ASC' }, // Chronological order
        select: { // Only select needed fields to reduce memory usage
          id: true, message: true, username: true, createdAt: true, characterId: true,
          skillId: true, skillName: true, skillBranch: true, skillType: true, skillOutput: true, skillRoll: true,
        },
      });

      // Format efficiently without reversing
      return messages.map(message => {
        // Use more memory-efficient object creation
        const formatted = {
          id: message.id,
          message: message.message,
          username: message.username,
          characterId: message.characterId,
          createdAt: message.createdAt
        };
        
        // Only add skill data if it exists to save memory
        if (message.skillId) {
          formatted.skill = {
            id: message.skillId,
            name: message.skillName,
            branch: message.skillBranch,
            type: message.skillType,
            output: message.skillOutput,
            roll: message.skillRoll
          };
        }
        
        return formatted;
      });
    } catch (error) {
      logger.error('Error fetching messages with memory optimization:', { 
        error: error.message, 
        locationId 
      });
      // Fallback to minimal messages on error
      return [];
    }
  }

  async addMessage(locationId, userId, username, message, skill = null) {
    // No client-side timeout: a stuck query is bounded by the pool's statement_timeout
    const character = await this.characterRepository.findOne({
      where: { userId, isActive: true },
      relations: { race: true }, // Need race for skill engine calculations
      // Experience and level-up use the row re-read under lock inside the post's transaction
      select: { id: true, name: true, userId: true, stats: true, raceId: true }
    });
    
    if (!character) {
      throw new HttpError(404, 'No active character found for this user.');
    }

    // Only the skill id is taken from the client; name, branch, output and roll come from the server
    const [fullSkill, lastMessage, constants] = await Promise.all([
      skill?.id
        ? AppDataSource.getRepository('Skill').findOne({ where: { id: skill.id }, relations: { branch: true, type: true } })
        : null,
      this.chatRepository.findOne({ where: { userId }, order: { createdAt: 'DESC' } }),
      staticDataCache.getCombatConstants()
    ]);

    const post = evaluatePost({
      length: message.length,
      lastPostAt: lastMessage ? new Date(lastMessage.createdAt).getTime() : null,
      now: Date.now(),
      ...chatRulesFromConstants(constants)
    });

    // Checks, target plan and the single roll happen before anything is written
    const skillUse = fullSkill
      ? await this.prepareSkillUse(locationId, character, fullSkill, skill.selectedTarget, post.grantsExperience)
      : null;

    const chatMessage = this.chatRepository.create({
      location: { id: locationId },
      userId,
      characterId: character.id,
      message,
      senderName: character.name || 'Unknown',
      username: character.name || 'Unknown',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(skillUse && toChatSkillFields(fullSkill, skillUse.calculation)),
    });

    // One post is one commit: combat action, skill usage, experience/level-up and the message.
    // If any step fails, none of them is saved.
    const savedMessage = await AppDataSource.transaction(async (manager) => {
      // The author's row is locked first (lock order in utils/rowLocks.js) and re-read, so the
      // experience and level-up write the current values
      const author = await lockCharacter(manager, character.id);

      // Ownership again, under lock: the skill may have been removed since prepareSkillUse checked it
      if (skillUse) {
        await lockOwnedSkill(manager, character.id, fullSkill.id);
      }

      if (skillUse?.plan.submitToCombat) {
        await this.submitToCombat(skillUse.roundId, character, fullSkill, skill.selectedTarget, skillUse.calculation, manager);
      }

      // Count the use here unless the combat submission already counted it
      if (skillUse?.plan.incrementUsageInChat) {
        await SkillUsageService.incrementSkillUsage(character.id, fullSkill.id, fullSkill.branchId, manager);
      }

      if (post.grantsExperience) {
        author.experience = (author.experience ?? 0) + post.experienceDelta;
        await manager.update(Character, author.id, { experience: author.experience });
        await this.characterStatsService.checkLevelUp(author, manager);
      }

      return manager.getRepository(ChatMessage).save(chatMessage);
    });

    // After commit: best-effort side effects that must not undo the post
    if (post.isValidPost) {
      try {
        await this.sessionParticipantService.ensureActiveSessionForLocation(locationId, userId, character.name);
        logger.session(`User ${userId} (${character.name}) participated in location ${locationId} with valid message`);
      } catch (sessionError) {
        // Log the error but don't fail the message sending
        logger.error('Failed to manage session participation:', { 
          error: sessionError.message, 
          userId, 
          locationId, 
          characterName: character.name 
        });
      }
    }

    if (skillUse?.plan.writeEngineLog) {
      try {
        await this.logChatSkillUse(locationId, character, fullSkill, skill.selectedTarget, skillUse.calculation);
      } catch (error) {
        logger.error('Error writing chat skill engine log:', { error: error.message });
      }
    }

    return savedMessage;
  }

  /**
   * Check that a skill may be used with this post and roll it once. Writes nothing: the caller
   * submits it to combat (when `plan.submitToCombat`) inside the post's transaction.
   * The single calculation is reused for the chat message, the combat action and the engine log.
   * @returns {Promise<{ plan: Object, calculation: Object, roundId: number|null }>}
   */
  async prepareSkillUse(locationId, character, fullSkill, selectedTarget, grantsExperience) {
    // Both the HTTP launch route and WS chat land here, so the ownership check covers both.
    // Checked early so nothing is rolled for a skill the character lacks; addMessage re-checks it under lock.
    const ownsSkill = await AppDataSource.getRepository(CharacterSkill).existsBy({
      characterId: character.id,
      skillId: fullSkill.id
    });
    if (!ownsSkill) {
      throw new HttpError(403, SKILL_NOT_OWNED);
    }

    const { CombatService } = await import('./CombatService.js');

    const [activeRound, activeEvent] = await Promise.all([
      new CombatService().getActiveRound(locationId),
      new EventService().getActiveEvent(locationId)
    ]);

    const plan = planChatSkillUse({
      skillTarget: fullSkill.target,
      hasSelectedTarget: Boolean(selectedTarget),
      hasActiveEvent: Boolean(activeEvent),
      hasActiveRound: Boolean(activeRound),
      grantsExperience
    });

    if (!plan.allowed) {
      throw new HttpError(400, plan.error);
    }

    const calculation = await this.skillExecutionService.calculateSkillOutput(character, fullSkill, { roll: rollD20() });

    return { plan, calculation, roundId: activeRound?.id ?? null };
  }

  /**
   * Submit the chat skill to the active combat round, inside the post's transaction.
   * Failures reach the sender and roll the whole post back.
   */
  async submitToCombat(roundId, character, fullSkill, selectedTarget, calculation, manager) {
    const { CombatActionService } = await import('./CombatActionService.js');

    // The client sends the selected chat user, so the target is looked up by userId
    const targetResolution = await this.targetResolutionService.resolveSkillTarget(
      fullSkill,
      character,
      selectedTarget?.userId,
      { lookupBy: 'userId', includeRelations: false, activeOnly: true }
    );

    if (!targetResolution.isValid) {
      throw new HttpError(400, `Failed to submit ${fullSkill.name} to combat: ${targetResolution.error}`);
    }

    try {
      await new CombatActionService().submitAction(
        roundId,
        character.id,
        fullSkill.id,
        targetResolution.targetId,
        { finalOutput: calculation.finalOutput, rollQuality: calculation.rollQuality },
        manager
      );
    } catch (error) {
      logger.error('Failed to submit action to combat:', { error: error.message });
      // Known errors (HttpError, unique violation) keep their status and safe message; anything
      // else propagates unchanged so the error handler answers a generic 500
      const known = httpResponseForError(error);
      if (!known) throw error;
      throw new HttpError(known.status, `Failed to submit ${fullSkill.name} to combat: ${known.message}`);
    }
  }

  /**
   * Write the engine log for a skill used in chat, with the same output shown in the message
   * @param {number} locationId - The location where the skill is used
   * @param {Object} character - The character using the skill
   * @param {Object} fullSkill - The skill being used (with branch and type)
   * @param {Object|undefined} selectedTarget - Target picked in chat, if any
   * @param {Object} calculation - Result of SkillExecutionService.calculateSkillOutput
   */
  async logChatSkillUse(locationId, character, fullSkill, selectedTarget, calculation) {
    const { finalOutput, outcomeMultiplier, rollQuality, skillUses, branchUses } = calculation;

    const engineData = {
      basePower: fullSkill.basePower,
      finalOutput,
      outcomeMultiplier,
      rollQuality,
      skillUses,
      branchUses,
      characterStats: character.stats,
      skillData: {
        id: fullSkill.id,
        name: fullSkill.name,
        branch: fullSkill.branch?.name,
        type: fullSkill.type?.name,
        target: fullSkill.target
      }
    };

    // Determine target for logging
    let targetName = null;
    if (selectedTarget) {
      targetName = selectedTarget.characterName || selectedTarget.username;
    } else if (fullSkill.target === 'self') {
      targetName = character.name;
    }

    await this.engineLogService.logSkillUsage(
      locationId,
      character.name,
      fullSkill.name,
      targetName,
      finalOutput,
      engineData
    );
  }
}

// Lock the character's character_skills row for the skill until the post commits (taken after the
// character row, per the lock order in utils/rowLocks.js). 403 when the character no longer has the skill.
async function lockOwnedSkill(manager, characterId, skillId) {
  const owned = await manager.getRepository(CharacterSkill).findOne({
    where: { characterId, skillId },
    lock: { mode: 'pessimistic_write' }
  });
  if (!owned) {
    throw new HttpError(403, SKILL_NOT_OWNED);
  }
}

// Chat message skill columns, built only from server-side data
function toChatSkillFields(fullSkill, calculation) {
  return {
    skillId: fullSkill.id,
    skillName: fullSkill.name,
    skillBranch: fullSkill.branch?.name,
    skillType: fullSkill.type?.name,
    skillOutput: calculation.finalOutput,
    skillRoll: `${calculation.rollQuality} Success`,
  };
}
