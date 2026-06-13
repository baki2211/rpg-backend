import { ChatService } from '../services/ChatService.js';
import { AppDataSource } from '../data-source.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const chatService = new ChatService();

export class ChatController {
  static getMessages = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    res.status(200).json(await chatService.getMessagesByLocation(Number(locationId)));
  });

  static addMessage = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    const { userId, username, message } = req.body;
    res.status(201).json(await chatService.addMessage(Number(locationId), userId, username, message));
  });

  static launchSkill = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { skillId } = req.params;
    const { locationId, message } = req.body;

    if (!locationId) {
      throw new HttpError(400, 'Location ID is required');
    }

    const character = await AppDataSource.getRepository('Character').findOne({
      where: { user: { id: userId }, isActive: true },
      relations: ['skills']
    });

    if (!character) {
      throw new HttpError(404, 'No active character found');
    }

    const hasSkill = character.skills.some(s => s.id === Number(skillId));
    if (!hasSkill) {
      throw new HttpError(403, 'Character does not have this skill');
    }

    const skill = await AppDataSource.getRepository('Skill').findOne({
      where: { id: skillId },
      relations: ['branch', 'type']
    });

    if (!skill) {
      throw new HttpError(404, 'Skill not found');
    }

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

    res.status(200).json(savedMessage);
  });
}
