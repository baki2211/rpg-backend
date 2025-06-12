import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';
import { Character } from '../models/characterModel.js';
import { SkillUsageService } from './SkillUsageService.js';
import { EngineLogService } from './EngineLogService.js';
import { SkillEngine } from './SkillEngine.js';
import { logger } from '../utils/logger.js';
import { CharacterService } from './CharacterService.js';

export class ChatService {
  chatRepository = AppDataSource.getRepository(ChatMessage);
  characterRepository = AppDataSource.getRepository(Character);
  engineLogService = new EngineLogService();
  characterService = new CharacterService();

  async getMessagesByLocation(locationId) {
    // Fetch messages from the past 5 hours
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const messages = await this.chatRepository.find({
      where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
      order: { createdAt: 'ASC' },
    });

    // Format the messages to include skill data in the correct structure
    return messages.map(message => ({
      ...message,
      skill: message.skillId ? {
        id: message.skillId,
        name: message.skillName,
        branch: message.skillBranch,
        type: message.skillType
      } : null
    }));
  }

  async addMessage(locationId, userId, username, message, skill = null) {
    const character = await this.characterRepository.findOne({ 
      where: { userId, isActive: true },
      relations: ['race'] // Need race for skill engine calculations
    });
    if (!character) {
      throw new Error('No active character found for this user.');
    }

    // Check if the message is more than 800 characters
    if (message.length > 800) {
      // Check if 5 minutes have passed since the last message
      const lastMessage = await this.chatRepository.findOne({
        where: { userId },
        order: { createdAt: 'DESC' }
      });

      const fiveMinutesAgo = new Date(Date.now() - 0.5 * 60 * 1000);
      if (!lastMessage || new Date(lastMessage.createdAt) < fiveMinutesAgo) {
        // Initialize experience points to 0 if not set
        if (character.experience === undefined || character.experience === null) {
          character.experience = 0;
        }

        // Increment character's experience points by 0.5
        character.experience += 0.5;

        // Check level up
        await this.characterService.checkLevelUp(character);
        
        // If a skill is used, process it through the skill engine and create logs
        if (skill && skill.id && skill.branchId) {
          try {
            await this.processSkillUsage(character, skill, locationId);
          } catch (error) {
            logger.error('Error processing skill usage:', { error: error.message });
          }
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
      }),
    });

    // Use a transaction to ensure atomicity
    return await AppDataSource.transaction(async (transactionalEntityManager) => {
      const characterRepository = transactionalEntityManager.getRepository(Character);
      const chatRepository = transactionalEntityManager.getRepository(ChatMessage);
      
      // Save the character
      await characterRepository.save(character);
      
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

    // Create skill engine instance and calculate output
    const skillEngine = new SkillEngine(character, fullSkill);
    const finalOutput = await skillEngine.computeFinalOutput();
    const outcomeMultiplier = skillEngine.rollOutcome();

    // Determine roll quality
    let rollQuality = 'Standard';
    if (outcomeMultiplier <= 0.6) rollQuality = 'Poor';
    else if (outcomeMultiplier >= 1.4) rollQuality = 'Critical';

    // Create engine log for skill usage
    const engineData = {
      basePower: fullSkill.basePower,
      finalOutput,
      outcomeMultiplier,
      rollQuality,
      skillUses: await skillEngine.getSkillUses(),
      branchUses: await skillEngine.getBranchUses(),
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

    // Create the engine log
    await this.engineLogService.logSkillUsage(
      locationId,
      character.name,
      fullSkill.name,
      targetName,
      finalOutput,
      engineData
    );

    // Increment skill usage counters
    const usageResult = await SkillUsageService.incrementSkillUsage(
      character.id, 
      skill.id, 
      skill.branchId
    );
    
    logger.skill(`Updated skill usage for ${fullSkill.name}: ${usageResult.skillUses} uses`);
    logger.skill(`Updated branch usage for branch ${skill.branchId}: ${usageResult.branchUses} uses`);
  }
}
