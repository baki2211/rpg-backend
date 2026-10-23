import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';
import { Character } from '../models/characterModel.js';
import { SkillUsageService } from './SkillUsageService.js';
import { EngineLogService } from './EngineLogService.js';
import { SessionParticipantService } from './SessionParticipantService.js';
import { logger } from '../utils/logger.js';
import { CharacterStatsService } from './CharacterStatsService.js';
import { EventService } from './EventService.js';
import { TargetResolutionService } from './TargetResolutionService.js';
import { SkillExecutionService } from './SkillExecutionService.js';
import { HttpError } from '../utils/HttpError.js';
import staticDataCache from '../utils/staticDataCache.js';
import { evaluatePost, chatRulesFromConstants } from '../domain/chat/messageRewards.js';
import { planChatSkillUse } from '../domain/chat/skillUse.js';

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
    // Memory optimization: Use minimal query and timeout
    const character = await Promise.race([
      this.characterRepository.findOne({ 
        where: { userId, isActive: true },
        relations: { race: true }, // Need race for skill engine calculations
        select: {
          id: true, name: true, userId: true, stats: true, raceId: true,
          experience: true, rank: true, statPoints: true, skillPoints: true // read by checkLevelUp
        }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Character lookup timeout')), 3000)
      )
    ]);
    
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

    const skillUse = fullSkill
      ? await this.useSkill(locationId, character, fullSkill, skill.selectedTarget, post.grantsExperience)
      : null;

    // Auto-create/manage session when user sends a valid message
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

    if (post.grantsExperience) {
      character.experience = (character.experience ?? 0) + post.experienceDelta;
      await this.characterStatsService.checkLevelUp(character);
    }

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

    // Use a transaction to ensure atomicity
    const savedMessage = await AppDataSource.transaction(async (transactionalEntityManager) => {
      const characterRepository = transactionalEntityManager.getRepository(Character);
      const chatRepository = transactionalEntityManager.getRepository(ChatMessage);
      
      // Save the character (if experience was gained)
      if (post.grantsExperience) {
        await characterRepository.save(character);
      }

      // Count the use here unless the combat submission already counted it
      if (skillUse?.plan.incrementUsageInChat) {
        await SkillUsageService.incrementSkillUsage(character.id, fullSkill.id, fullSkill.branchId, transactionalEntityManager);
      }
      
      // Save the chat message
      return await chatRepository.save(chatMessage);
    });

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
   * Check that a skill may be used with this post, roll it once and submit it to combat when required.
   * The single calculation is reused for the chat message, the combat action and the engine log.
   * @returns {Promise<{ plan: Object, calculation: Object }>}
   */
  async useSkill(locationId, character, fullSkill, selectedTarget, grantsExperience) {
    const { CombatService } = await import('./CombatService.js');
    const { CombatActionService } = await import('./CombatActionService.js');

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

    const calculation = await this.skillExecutionService.calculateSkillOutput(character, fullSkill);
    if (!calculation.success) {
      throw new HttpError(500, `Skill calculation failed: ${calculation.error}`);
    }

    if (plan.submitToCombat) {
      await this.submitToCombat(new CombatActionService(), activeRound.id, character, fullSkill, selectedTarget, calculation);
    }

    return { plan, calculation };
  }

  /**
   * Submit the chat skill to the active combat round. Failures reach the sender.
   */
  async submitToCombat(combatActionService, roundId, character, fullSkill, selectedTarget, calculation) {
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
      await combatActionService.submitAction(
        roundId,
        character.id,
        fullSkill.id,
        targetResolution.targetId,
        { finalOutput: calculation.finalOutput, rollQuality: calculation.rollQuality }
      );
    } catch (error) {
      logger.error('Failed to submit action to combat:', { error: error.message });
      throw new HttpError(error.statusCode ?? 500, `Failed to submit ${fullSkill.name} to combat: ${error.message}`);
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
