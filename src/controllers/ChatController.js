import { ChatService } from '../services/ChatService.js';
import { AppDataSource } from '../data-source.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';

const chatService = new ChatService();

// Ids must be positive integers; anything else is a 400 (TypeORM 1.0 throws on undefined in `where`)
const parseId = (raw) => {
  const id = Number(raw);
  return raw != null && raw !== '' && Number.isInteger(id) && id > 0 ? id : null;
};

export class ChatController {
  static getMessages = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    res.status(200).json(await chatService.getMessagesByLocation(locationId));
  });

  static addMessage = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    const { message } = req.body;
    if (typeof message !== 'string' || message.length === 0) {
      throw new HttpError(400, 'Message is required');
    }
    // The author is the logged-in user, never a userId from the body
    res.status(201).json(await chatService.addMessage(locationId, req.user.id, req.user.username, message));
  });

  static launchSkill = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const skillId = InputValidator.validateSkillId(req.params.skillId);
    const locationId = parseId(req.body.locationId);
    const { message } = req.body;

    if (!locationId) {
      throw new HttpError(400, 'Location ID is required');
    }

    const skill = await AppDataSource.getRepository('Skill').findOne({
      where: { id: skillId },
      relations: { branch: true, type: true }
    });

    if (!skill) {
      throw new HttpError(404, 'Skill not found');
    }

    // ChatService.addMessage loads the active character and checks it owns the skill (403 otherwise)
    const savedMessage = await chatService.addMessage(
      locationId,
      userId,
      req.user.username,
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
