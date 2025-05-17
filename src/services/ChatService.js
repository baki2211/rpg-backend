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
    return this.chatRepository.find({
      where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
      order: { createdAt: 'ASC' },
    });
  }

  async addMessage(locationId, userId, username, message) {
    const character = await this.characterRepository.findOne({ where: { userId, isActive: true } });
    if (!character) {
      throw new Error('No active character found for this user.');
    }

    const chatMessage = this.chatRepository.create({
      location: { id: locationId },
      userId,
      characterId: character.id,
      message,
      senderName: character.name,
      username: character.name,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.chatRepository.save(chatMessage);
  }
}
