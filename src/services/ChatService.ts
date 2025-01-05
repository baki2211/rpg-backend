import { MoreThan } from 'typeorm';
import { AppDataSource } from '../data-source.js';
import { ChatMessage } from '../models/chatMessageModel.js';

export class ChatService {
  private chatRepository = AppDataSource.getRepository(ChatMessage);

  async getMessagesByLocation(locationId: number): Promise<ChatMessage[]> {
    // Fetch messages from the past 5 hours
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    return this.chatRepository.find({
      where: { location: { id: locationId }, createdAt: MoreThan(fiveHoursAgo) },
      order: { createdAt: 'ASC' },
    });
  }

  async addMessage(locationId: number, userId: number, username: string, message: string): Promise<ChatMessage> {
    const chatMessage = this.chatRepository.create({ location: { id: locationId }, userId, username, message });
    return this.chatRepository.save(chatMessage);
  }
}
