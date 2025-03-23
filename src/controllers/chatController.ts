import { Request, Response } from 'express';
import { ChatService } from '../services/ChatService.js';

const chatService = new ChatService();

export class ChatController {
  static async getMessages(req: Request, res: Response): Promise<void> {
    const { locationId } = req.params;
    try {
      const messages = await chatService.getMessagesByLocation(Number(locationId));
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  static async addMessage(req: Request, res: Response): Promise<void> {
    const { locationId } = req.params;
    const { userId, username, message } = req.body;
    try {
      const newMessage = await chatService.addMessage(Number(locationId), userId, username, message);
      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Error adding message:', error);
      res.status(500).json({ error: 'Failed to add message' });
    }
  }
}