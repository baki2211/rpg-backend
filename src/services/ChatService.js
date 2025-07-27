import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';
import { Character } from '../models/characterModel.js';
import { SkillUsageService } from './SkillUsageService.js';
import { EngineLogService } from './EngineLogService.js';
import { SkillEngine } from './SkillEngine.js';
import { SessionService } from './SessionService.js';
import { logger } from '../utils/logger.js';
import { CharacterService } from './CharacterService.js';
import { CombatService } from './CombatService.js';
import { EventService } from './EventService.js';
import { PvPResolutionService } from './PvPResolutionService.js';
import { TargetResolutionService } from './TargetResolutionService.js';
import { SkillExecutionService } from './SkillExecutionService.js';

export class ChatService {
  chatRepository = AppDataSource.getRepository(ChatMessage);
  characterRepository = AppDataSource.getRepository(Character);
  engineLogService = new EngineLogService();
  characterService = new CharacterService();
  sessionService = new SessionService();
  targetResolutionService = new TargetResolutionService();
  skillExecutionService = new SkillExecutionService();

  async getMessagesByLocation(locationId) {
    // Keep messages for 5 hours as intended, but optimize memory usage
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    
    try {
      const messages = await this.chatRepository.find({
        where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
        order: { createdAt: 'ASC' }, // Chronological order
        select: [ // Only select needed fields to reduce memory usage
          'id', 'message', 'username', 'createdAt', 'characterId',
          'skillId', 'skillName', 'skillBranch', 'skillType', 'skillOutput', 'skillRoll'
        ]
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
        relations: ['race'], // Need race for skill engine calculations
        select: ['id', 'name', 'userId', 'stats', 'raceId'] // Only select needed fields
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Character lookup timeout')), 3000)
      )
    ]);
    
    if (!character) {
      throw new Error('No active character found for this user.');
    }

    // If skill is provided, validate and process it
    if (skill && skill.id) {
      try {
        // Get the full skill data if we only have basic info
        const fullSkill = await AppDataSource.getRepository('Skill').findOne({
          where: { id: skill.id },
          relations: ['branch', 'type']
        });

        if (fullSkill) {
          // Check context for skill validation
          const { CombatService } = await import('./CombatService.js');
          const { EventService } = await import('./EventService.js');
          
          const combatService = new CombatService();
          const eventService = new EventService();
          
          const [activeRound, activeEvent] = await Promise.all([
            combatService.getActiveRound(locationId).catch(() => null),
            eventService.getActiveEvent(locationId).catch(() => null)
          ]);

          // Check for attack/debuff skills that target others in combat scenarios
          const skillTypeCategory = PvPResolutionService.getSkillTypeCategory(fullSkill.type?.name);
          const isAttackOrDebuff = skillTypeCategory === 'Attack' || skillTypeCategory === 'Debuff';
          const hasOtherTarget = fullSkill.target === 'other' && skill.selectedTarget;

          // Skills with 'other' target require at least an active event (unless it's self/none/any target)
          if (hasOtherTarget && !activeEvent && !activeRound) {
            throw new Error('Skills targeting other players can only be used during active events or combat rounds');
          }

          const { SkillEngine } = await import('./SkillEngine.js');
          const skillEngine = new SkillEngine(character, fullSkill);
          const finalOutput = await skillEngine.computeFinalOutput();
          const outcomeMultiplier = skillEngine.rollOutcome();

          // Determine roll quality
          let rollQuality = 'Standard';
          if (outcomeMultiplier <= 0.6) rollQuality = 'Poor';
          else if (outcomeMultiplier >= 1.4) rollQuality = 'Critical';
          
          // Add the results to the skill data for chat display
          skill = {
            ...skill,
            output: finalOutput,
            roll: `${rollQuality} Success`
          };

          // If there's an active combat round and this skill should participate in combat, submit to combat
          // Submit if: targeting others OR if it's a self-targeting skill that can interact in combat (like self-defense)
          const shouldSubmitToCombat = hasOtherTarget || 
            (activeRound && (fullSkill.target === 'self' || fullSkill.target === 'any' || fullSkill.target === 'none'));
          
          if (shouldSubmitToCombat) {
            try {
              // Use TargetResolutionService for standardized target resolution
              const targetIdentifier = skill.selectedTarget?.userId || skill.selectedTarget?.characterName || skill.selectedTarget;
              
              const targetResolution = await this.targetResolutionService.resolveSkillTarget(
                fullSkill,
                character,
                targetIdentifier,
                { includeRelations: false, activeOnly: true }
              );

              if (!targetResolution.isValid) {
                throw new Error(targetResolution.error);
              }

              const combatTargetId = targetResolution.targetId;
              
              // Submit action to combat with pre-calculated values
              const submissionResult = await combatService.submitAction(
                activeRound.id,
                character.id,
                fullSkill.id,
                combatTargetId,
                {
                  finalOutput,
                  rollQuality
                }
              );
            } catch (error) {
              logger.error('Failed to submit action to combat:', { error: error.message });
              
              // Re-throw the error so the user knows something went wrong
              throw new Error(`Failed to submit ${fullSkill.name} to combat: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.error('Error processing skill:', error);
        // Re-throw validation errors to prevent invalid skills from being sent
        if (error.message.includes('can only be used during')) {
          throw error;
        }
      }
    }

    // Determine if this is a "valid message" (more than 800 characters)
    const isValidMessage = message.length > 800;
    let shouldProcessSkill = false;
    let shouldGainExperience = false;

    if (isValidMessage) {
      // Check if 5 minutes have passed since the last message for experience
      const lastMessage = await this.chatRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      const fiveMinutesAgo = new Date(Date.now() - 0.5 * 60 * 1000);
      if (!lastMessage || new Date(lastMessage.createdAt) < fiveMinutesAgo) {
        shouldGainExperience = true;
        shouldProcessSkill = skill && skill.id && skill.branchId;
      }
    }

    // Auto-create/manage session when user sends a valid message
    if (isValidMessage) {
      try {
        await this.sessionService.ensureActiveSessionForLocation(locationId, userId, character.name);
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

    if (shouldGainExperience) {
      // Initialize experience points to 0 if not set
      if (character.experience === undefined || character.experience === null) {
        character.experience = 0;
      }

      // Increment character's experience points by 0.5
      character.experience += 0.5;

      // Check level up
      await this.characterService.checkLevelUp(character);
      
      // If a skill is used, process it through the skill engine and create logs
      if (shouldProcessSkill) {
        try {
          await this.processSkillUsage(character, skill, locationId);
        } catch (error) {
          logger.error('Error processing skill usage:', { error: error.message });
        }
      }
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
      // Add skill data if present
      ...(skill && {
        skillId: skill.id,
        skillName: skill.name,
        skillBranch: skill.branch?.name || skill.branch,
        skillType: skill.type?.name || skill.type,
        skillOutput: skill.output,
        skillRoll: skill.roll,
      }),
    });

    // Use a transaction to ensure atomicity
    return await AppDataSource.transaction(async (transactionalEntityManager) => {
      const characterRepository = transactionalEntityManager.getRepository(Character);
      const chatRepository = transactionalEntityManager.getRepository(ChatMessage);
      
      // Save the character (if experience was gained)
      if (shouldGainExperience) {
        await characterRepository.save(character);
      }
      
      // Save the chat message
      const savedMessage = await chatRepository.save(chatMessage);
      return savedMessage;
    });
  }

  /**
   * Process skill usage through the skill engine and create appropriate logs
   * @param {Object} character - The character using the skill
   * @param {Object} skill - The skill being used
   * @param {number} locationId - The location where the skill is used
   */
  async processSkillUsage(character, skill, locationId) {
    // Import the actual skill model to get full skill data
    const { Skill } = await import('../models/skillModel.js');
    const skillRepository = AppDataSource.getRepository(Skill);
    
    const fullSkill = await skillRepository.findOne({
      where: { id: skill.id },
      relations: ['branch', 'type']
    });

    if (!fullSkill) {
      throw new Error('Skill not found');
    }

    // Only increment skill usage counters for experience-gaining messages
    // Combat/event skill usage is handled by CombatService and EventService
    const usageResult = await SkillUsageService.incrementSkillUsage(
      character.id, 
      skill.id, 
      skill.branchId
    );
    
    logger.skill(`Updated skill usage for ${fullSkill.name}: ${usageResult.skillUses} uses`);
    logger.skill(`Updated branch usage for branch ${skill.branchId}: ${usageResult.branchUses} uses`);

    // Create skill engine instance and calculate output for the chat message
    const skillEngine = new SkillEngine(character, fullSkill);
    const finalOutput = await skillEngine.computeFinalOutput();
    const outcomeMultiplier = skillEngine.rollOutcome();

    // Determine roll quality
    let rollQuality = 'Standard';
    if (outcomeMultiplier <= 0.6) rollQuality = 'Poor';
    else if (outcomeMultiplier >= 1.4) rollQuality = 'Critical';

    // Get usage data in a single batched operation to avoid N+1 queries
    const { skillUses, branchUses } = await skillEngine.getUsageData();

    // Create engine log for skill usage in chat (outside combat/events)
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
    if (skill.selectedTarget) {
      targetName = skill.selectedTarget.characterName || skill.selectedTarget.username;
    } else if (fullSkill.target === 'self') {
      targetName = character.name;
    }

    // Create the engine log for chat-based skill usage
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
