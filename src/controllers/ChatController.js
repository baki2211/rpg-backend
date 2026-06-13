import { ChatService } from '../services/ChatService.js';
import { AppDataSource } from '../data-source.js';

const chatService = new ChatService();

export class ChatController {
  static async getMessages(req, res) {
    const { locationId } = req.params;
    try {
      const messages = await chatService.getMessagesByLocation(Number(locationId));
      res.status(200).json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  static async addMessage(req, res) {
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

  static async launchSkill(req, res) {
    try {
      const userId = req.user.id;
      const { skillId } = req.params;
      const { locationId, message } = req.body;

      if (!locationId) {
        return res.status(400).json({ error: 'Location ID is required' });
      }

      // Get the active character for the user
      const character = await AppDataSource.getRepository('Character').findOne({
        where: { user: { id: userId }, isActive: true },
        relations: ['skills']
      });

      if (!character) {
        return res.status(404).json({ error: 'No active character found' });
      }

      // Check if character has the skill
      const hasSkill = character.skills.some(skill => skill.id === Number(skillId));
      if (!hasSkill) {
        return res.status(403).json({ error: 'Character does not have this skill' });
      }

      // Get the skill details
      const skill = await AppDataSource.getRepository('Skill').findOne({
        where: { id: skillId },
        relations: ['branch', 'type']
      });

      if (!skill) {
        return res.status(404).json({ error: 'Skill not found' });
      }

      // Use the ChatService to add the message with skill data
      const savedMessage = await chatService.addMessage(
        Number(locationId),
        userId,
        character.name,
        message || `*launches ${skill.name}*`,
        {
          id: skill.id,
          name: skill.name,
          branch: skill.branch,
          type: skill.type
        }
      );

      // The WebSocket server will handle broadcasting the message
      res.status(200).json(savedMessage);
    } catch (error) {
      console.error('Error launching skill:', error);
      res.status(500).json({ error: 'Failed to launch skill' });
    }
  }
}