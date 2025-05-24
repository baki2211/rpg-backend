import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';
import { Character } from '../models/characterModel.js';

export class ChatService {
  chatRepository = AppDataSource.getRepository(ChatMessage);
  characterRepository = AppDataSource.getRepository(Character);

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
    const character = await this.characterRepository.findOne({ where: { userId, isActive: true } });
    if (!character) {
      throw new Error('No active character found for this user.');
    }

    console.log('Adding message with skill data:', { skill });

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
        console.log(`Updated experience points for character ${character.id}: ${character.experience}`);
        // If a skill is used, increment its usage counter
        if (skill) {
          const skillRepository = AppDataSource.getRepository('Skill');
          const characterSkill = await skillRepository.findOne({
            where: { id: skill.id },
            relations: ['characters']
          });

          if (characterSkill) {
            // Initialize usage to 0 if not set
            if (characterSkill.usage === undefined || characterSkill.usage === null) {
              characterSkill.usage = 0;
            }
            characterSkill.usage += 1;
            console.log(`Updated skill usage for ${skill.name}: ${characterSkill.usage}`);
            await skillRepository.save(characterSkill);
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

    console.log('Created chat message with data:', chatMessage);

    // Use a transaction to ensure atomicity
    return await AppDataSource.transaction(async (transactionalEntityManager) => {
      const characterRepository = transactionalEntityManager.getRepository(Character);
      const chatRepository = transactionalEntityManager.getRepository(ChatMessage);
      
      // Log the character's experience points before saving
      console.log(`Character experience points before save: ${character.experience}`);
      
      // Save the character
      await characterRepository.save(character);
      
      // Log the character's experience points after saving
      const updatedCharacter = await characterRepository.findOne({ where: { id: character.id } });
      console.log(`Character experience points after save: ${updatedCharacter.experience}`);
      
      // Save the chat message
      const savedMessage = await chatRepository.save(chatMessage);
      console.log('Saved chat message:', savedMessage);
      return savedMessage;
    });
  }
}
