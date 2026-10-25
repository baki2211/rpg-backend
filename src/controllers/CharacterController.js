import { CharacterService } from '../services/CharacterService.js';
import { CharacterStatsService } from '../services/CharacterStatsService.js';
import { CharacterSkillsService } from '../services/CharacterSkillsService.js';
import { NPCService } from '../services/NPCService.js';
import { InputValidator } from '../utils/inputValidator.js';
import { AuditLogger } from '../utils/auditLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { deleteUploadedFile, deleteImageFileIfUnreferenced } from '../utils/uploadedFiles.js';
import {
  CHARACTER_PLACEHOLDER_IMAGE_URL,
  characterImageUrlFor
} from '../domain/character/characterImage.js';

const characterService = new CharacterService();
const characterStatsService = new CharacterStatsService();
const characterSkillsService = new CharacterSkillsService();
const npcService = new NPCService();

// The upload middleware already wrote the new file; when the request fails, nothing points at it.
const discardUpload = (file) => (file ? deleteUploadedFile(file.filename).catch(() => {}) : undefined);

export class CharacterController {
  static createCharacter = asyncHandler(async (req, res) => {
    let validatedData, userId, character;
    try {
      validatedData = InputValidator.validateCharacterCreation(req.body);
      userId = InputValidator.validateUserId(req.user.id);
      const imageUrl = req.file ? characterImageUrlFor(req.file.filename) : CHARACTER_PLACEHOLDER_IMAGE_URL;
      character = await characterService.createCharacter(validatedData, userId, imageUrl);
    } catch (error) {
      await discardUpload(req.file);
      throw error;
    }

    AuditLogger.logCharacter(
      AuditLogger.EventTypes.CHARACTER_CREATE,
      userId,
      character.id,
      req,
      {
        character_name: character.name,
        race_id: validatedData.race?.id,
        has_image: !!req.file
      }
    );

    res.status(201).json(character);
  });

  static getCharacters = asyncHandler(async (req, res) => {
    const characters = await characterService.getCharactersByUser(req.user.id);
    res.status(200).json(characters);
  });

  static getAllCharacters = asyncHandler(async (req, res) => {
    const characters = await characterService.getAllCharacters();
    res.status(200).json(characters);
  });

  static activateCharacter = asyncHandler(async (req, res) => {
    const userId = InputValidator.validateUserId(req.user.id);
    const characterId = InputValidator.validateCharacterId(req.params.id);

    await characterService.activateCharacter(characterId, userId);

    AuditLogger.logCharacter(
      AuditLogger.EventTypes.CHARACTER_ACTIVATE,
      userId,
      characterId,
      req,
      { action: 'activate' }
    );

    res.status(204).end();
  });

  static deleteCharacter = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const characterId = InputValidator.validateCharacterId(req.params.id);

    await characterService.deleteCharacter(characterId, userId);

    AuditLogger.logCharacter(
      AuditLogger.EventTypes.CHARACTER_DELETE,
      userId,
      characterId,
      req,
      { character_id: characterId }
    );

    res.status(204).end();
  });

  static uploadCharacterImage = asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'An image file is required');

    let result;
    try {
      const userId = InputValidator.validateUserId(req.user.id);
      const characterId = InputValidator.validateCharacterId(req.params.characterId);
      result = await characterService.updateCharacterImage(characterId, userId, characterImageUrlFor(req.file.filename));
    } catch (error) {
      await discardUpload(req.file);
      throw error;
    }
    await deleteImageFileIfUnreferenced(result.fileToDelete);

    res.status(200).json(result.character);
  });

  static deleteCharacterImage = asyncHandler(async (req, res) => {
    const userId = InputValidator.validateUserId(req.user.id);
    const characterId = InputValidator.validateCharacterId(req.params.characterId);

    const { fileToDelete } = await characterService.updateCharacterImage(
      characterId,
      userId,
      CHARACTER_PLACEHOLDER_IMAGE_URL
    );
    await deleteImageFileIfUnreferenced(fileToDelete);

    res.status(204).end();
  });

  static getAvailableSkills = asyncHandler(async (req, res) => {
    const characterId = InputValidator.validateCharacterId(req.params.id);
    const availableSkills = await characterSkillsService.getAvailableSkills(characterId, req.user.id);
    res.status(200).json(availableSkills);
  });

  static updateCharacterStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const characterId = InputValidator.validateCharacterId(req.params.id);
    const statUpdates = req.body;

    if (!statUpdates || typeof statUpdates !== 'object') {
      throw new HttpError(400, 'Stat updates must be provided as an object');
    }

    const updatedCharacter = await characterStatsService.updateCharacterStats(
      characterId,
      userId,
      statUpdates
    );

    AuditLogger.logCharacter(
      AuditLogger.EventTypes.CHARACTER_STATS_UPDATE,
      userId,
      characterId,
      req,
      {
        updated_stats: Object.keys(statUpdates),
        stat_count: Object.keys(statUpdates).length
      }
    );

    res.status(200).json(updatedCharacter);
  });

  // NPC Management Methods
  static createNPC = asyncHandler(async (req, res) => {
    const npc = await npcService.createNPC(req.body, req.user.id);
    res.status(201).json(npc);
  });

  static getAllNPCs = asyncHandler(async (req, res) => {
    const npcs = await npcService.getAllNPCs();
    res.status(200).json(npcs);
  });

  static updateNPC = asyncHandler(async (req, res) => {
    const npcId = InputValidator.validateCharacterId(req.params.id);
    const updatedNPC = await npcService.updateNPC(npcId, req.body);
    res.status(200).json(updatedNPC);
  });

  static deleteNPC = asyncHandler(async (req, res) => {
    const npcId = InputValidator.validateCharacterId(req.params.id);
    await npcService.deleteNPC(npcId);
    res.status(204).end();
  });

  static getAvailableNPCs = asyncHandler(async (req, res) => {
    const npcs = await npcService.getAvailableNPCs();
    res.status(200).json(npcs);
  });

  static getActiveNPC = asyncHandler(async (req, res) => {
    const activeNPC = await npcService.getActiveNPCForUser(req.user.id);
    res.status(200).json(activeNPC);
  });

  static activateNPC = asyncHandler(async (req, res) => {
    const npcId = InputValidator.validateCharacterId(req.params.id);
    const activatedNPC = await npcService.activateNPC(npcId, req.user.id);
    res.status(200).json(activatedNPC);
  });

  static deactivateNPC = asyncHandler(async (req, res) => {
    const npcId = InputValidator.validateCharacterId(req.params.id);
    await npcService.deactivateNPC(npcId, req.user.id);
    res.status(204).end();
  });

  static getCharacterById = asyncHandler(async (req, res) => {
    const characterId = InputValidator.validateCharacterId(req.params.id);
    const character = await characterService.getCharacterById(characterId, req.user.id);
    if (!character) throw new HttpError(404, 'Character not found');
    res.status(200).json(character);
  });

  static getAcquiredSkills = asyncHandler(async (req, res) => {
    const characterId = InputValidator.validateCharacterId(req.params.id);
    const skills = await characterSkillsService.getAcquiredSkills(characterId, req.user.id);
    res.status(200).json(skills);
  });

  static getCharacterStatsWithDefinitions = asyncHandler(async (req, res) => {
    const characterId = InputValidator.validateCharacterId(req.params.id);
    const characterStats = await characterStatsService.getCharacterStatsWithDefinitions(
      characterId,
      req.user.id
    );
    res.status(200).json(characterStats);
  });
}
