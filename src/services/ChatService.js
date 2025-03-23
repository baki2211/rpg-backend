import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { MoreThan } from 'typeorm';

export class ChatService {
  chatRepository = AppDataSource.getRepository(ChatMessage);

  async getMessagesByLocation(locationId) {
    // Fetch messages from the past 5 hours
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return this.chatRepository.find({
      where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
      order: { createdAt: 'ASC' },
    });
  }

  async addMessage(locationId, userId, username, message) {
    const chatMessage = this.chatRepository.create({ location: { id: locationId }, userId, username, message });
    return this.chatRepository.save(chatMessage);
  }
}
