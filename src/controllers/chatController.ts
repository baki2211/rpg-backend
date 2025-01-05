import { Request, Response } from 'express';
import { ChatService } from '../services/ChatService.js';

const chatService = new ChatService();

export class ChatController {
  static async getMessages(req: Request, res: Response): Promise<void> {
    const { locationId } = req.params;
    const messages = await chatService.getMessagesByLocation(Number(locationId));
    res.status(200).json(messages);
  }

  static async addMessage(req: Request, res: Response): Promise<void> {
    const { locationId } = req.params;
    const { userId, username, message } = req.body;
    const newMessage = await chatService.addMessage(Number(locationId), userId, username, message);
    res.status(201).json(newMessage);
  }
}
