import { CharacterService } from '../services/CharacterService.js';
import { CharacterStatsService } from '../services/CharacterStatsService.js';
import { CharacterSkillsService } from '../services/CharacterSkillsService.js';
import { NPCService } from '../services/NPCService.js';
import { StatDefinitionService } from '../services/StatDefinitionService.js';
import { InputValidator } from '../utils/inputValidator.js';
import { AuditLogger } from '../utils/auditLogger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import fs from 'fs';
import path from 'path';

const characterService = new CharacterService();
const characterStatsService = new CharacterStatsService();
const characterSkillsService = new CharacterSkillsService();
const npcService = new NPCService();
const statDefinitionService = new StatDefinitionService();

const parseCharacterId = (raw) => {
  const id = Number(raw);
  if (!raw || Number.isNaN(id)) {
    throw new HttpError(400, 'Invalid character ID provided');
  }
  return id;
};

export class CharacterController {
  static createCharacter = asyncHandler(async (req, res) => {
    const validatedData = InputValidator.validateCharacterCreation(req.body);
    const userId = InputValidator.validateUserId(req.user.id);
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.jpg';

    const character = await characterService.createCharacter(validatedData, userId, imageUrl);

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
    const characterId = parseCharacterId(req.params.id);

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
    const userId = req.user.id;
    const characterId = Number(req.params.characterId);
    const character = await characterService.getCharacterById(characterId, userId);
    if (!character) throw new HttpError(404, 'Character not found');

    if (character.imageUrl && !character.imageUrl.includes('placeholder.png')) {
      fs.unlinkSync(path.resolve('uploads', character.imageUrl));
    }

    const filename = req.file.filename;
    const updated = await characterService.updateCharacterImage(characterId, userId, filename);
    res.status(200).json(updated);
  });

  static deleteCharacterImage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const characterId = Number(req.params.characterId);
    const character = await characterService.getCharacterById(characterId, userId);

    if (!character || !character.imageUrl) {
      throw new HttpError(404, 'Character or image not found');
    }

    if (!character.imageUrl.includes('placeholder.png')) {
      fs.unlinkSync(path.resolve('uploads', character.imageUrl));
    }

    await characterService.updateCharacterImage(characterId, userId, 'placeholder.png');
    res.status(204).end();
  });

  static acquireSkill = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const skillId = Number(req.params.skillId);
    const character = await characterSkillsService.acquireSkill(skillId, userId);

    AuditLogger.logEvent(
      AuditLogger.EventTypes.SKILL_ACQUIRE,
      {
        userId,
        characterId: character.id,
        req,
        riskLevel: AuditLogger.RiskLevels.LOW,
        details: { skill_id: skillId }
      }
    );

    res.status(200).json(character);
  });

  static getAvailableSkills = asyncHandler(async (req, res) => {
    const availableSkills = await characterSkillsService.getAvailableSkills(
      Number(req.params.characterId),
      req.user.id
    );
    res.status(200).json(availableSkills);
  });

  static getCharacterStats = asyncHandler(async (req, res) => {
    const characterStats = await characterStatsService.getCharacterStatsWithDefinitions(
      Number(req.params.characterId),
      req.user.id
    );
    res.status(200).json(characterStats);
  });

  static updateCharacterStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const characterId = Number(req.params.characterId);
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

  static resetCharacterStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const characterId = Number(req.params.characterId);

    const character = await characterService.getCharacterById(characterId, userId);
    if (!character) throw new HttpError(404, 'Character not found');

    const raceDefaults = character.race.statBonuses || {};
    const statDefinitions = await statDefinitionService.getAllStatDefinitions(null, true);
    const resetStats = {};
    for (const statDef of statDefinitions) {
      resetStats[statDef.internalName] = raceDefaults[statDef.internalName] || statDef.defaultValue || 0;
    }

    const updatedCharacter = await characterStatsService.updateCharacterStats(
      characterId,
      userId,
      resetStats
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
    const updatedNPC = await npcService.updateNPC(Number(req.params.id), req.body);
    res.status(200).json(updatedNPC);
  });

  static deleteNPC = asyncHandler(async (req, res) => {
    await npcService.deleteNPC(Number(req.params.id));
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
    const activatedNPC = await npcService.activateNPC(Number(req.params.id), req.user.id);
    res.status(200).json(activatedNPC);
  });

  static deactivateNPC = asyncHandler(async (req, res) => {
    await npcService.deactivateNPC(Number(req.params.id), req.user.id);
    res.status(204).end();
  });

  static getCharacterById = asyncHandler(async (req, res) => {
    const characterId = parseCharacterId(req.params.id);
    const character = await characterService.getCharacterById(characterId, req.user.id);
    if (!character) throw new HttpError(404, 'Character not found');
    res.status(200).json(character);
  });

  static getAcquiredSkills = asyncHandler(async (req, res) => {
    const characterId = parseCharacterId(req.params.id);
    const skills = await characterSkillsService.getAcquiredSkills(characterId, req.user.id);
    res.status(200).json(skills);
  });

  static getCharacterStatsWithDefinitions = asyncHandler(async (req, res) => {
    const characterId = parseCharacterId(req.params.id);
    const characterStats = await characterStatsService.getCharacterStatsWithDefinitions(
      characterId,
      req.user.id
    );
    res.status(200).json(characterStats);
  });
}
