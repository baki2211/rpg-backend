import { CharacterService } from '../services/CharacterService.js';
import { CharacterStatsService } from '../services/CharacterStatsService.js';
import { CharacterSkillsService } from '../services/CharacterSkillsService.js';
import { NPCService } from '../services/NPCService.js';
import { StatDefinitionService } from '../services/StatDefinitionService.js';
import { InputValidator } from '../utils/inputValidator.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { AuditLogger } from '../utils/auditLogger.js';
import fs from 'fs';
import path from 'path';

const characterService = new CharacterService();
const characterStatsService = new CharacterStatsService();
const characterSkillsService = new CharacterSkillsService();
const npcService = new NPCService();
const statDefinitionService = new StatDefinitionService();

export class CharacterController {
  static async createCharacter(req, res) {
    try {
      console.log('Character creation request body:', req.body);
      console.log('User from token:', req.user);
      
      // Validate and sanitize inputs
      const validatedData = InputValidator.validateCharacterCreation(req.body);
      console.log('Validated data:', validatedData);
      
      const userId = InputValidator.validateUserId(req.user.id);
      console.log('Validated userId:', userId);
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.jpg';
      
      const character = await characterService.createCharacter(validatedData, userId, imageUrl);
      
      // Log character creation
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
    } catch (error) {
      console.error('Character creation error:', error);
      console.error('Request body:', req.body);
      console.error('User:', req.user);
      res.status(400).json({ error: error.message });
    }
  }

  static async getCharacters(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const characters = await characterService.getCharactersByUser(userId);
      res.status(200).json(characters);
    } catch (error) {
      res.status(400).json({ error: (error).message });
    }
  }

  /**
   * Get all characters (admin only) - for simulator and admin tools
   */
  static async getAllCharacters(req, res) {
    try {
      // Check if user has admin permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const characters = await characterService.getAllCharacters();
      res.status(200).json(characters);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async activateCharacter(req, res) {
    try {
      // Validate and sanitize inputs
      const userId = InputValidator.validateUserId(req.user.id);
      const characterId = InputValidator.validateCharacterId(req.params.id);
  
      await characterService.activateCharacter(characterId, userId);
      
      // Log character activation
      AuditLogger.logCharacter(
        AuditLogger.EventTypes.CHARACTER_ACTIVATE,
        userId,
        characterId,
        req,
        { action: 'activate' }
      );
      
      res.status(204).end();
    } catch (error) {
      console.error('Activate character error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteCharacter(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      // Handle both :id and :characterId parameter formats
      const characterId = req.params.id || req.params.characterId;
      
      if (!characterId) {
        return res.status(400).json({ error: 'Character ID is required' });
      }

      const id = Number(characterId);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid character ID provided' });
      }

      await characterService.deleteCharacter(id, userId);
      
      // Log character deletion
      AuditLogger.logCharacter(
        AuditLogger.EventTypes.CHARACTER_DELETE,
        userId,
        id,
        req,
        { character_id: id }
      );
      
      res.status(204).end();
    } catch (error) {
      console.error('Delete character error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  static async uploadCharacterImage(req, res) {
    try {
      const userId = req.user.id;
      const characterId = Number(req.params.characterId);
      const character = await characterService.getCharacterById(characterId, userId);
      if (!character) return res.status(404).json({ error: 'Character not found' });

      // Delete old image if it exists and isn't the default
      if (character.imageUrl && !character.imageUrl.includes('placeholder.png')) {
        fs.unlinkSync(path.resolve('uploads', character.imageUrl));
      }

      const filename = req.file.filename;
      const updated = await characterService.updateCharacterImage(characterId, userId, filename);
      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteCharacterImage(req, res) {
    try {
      const userId = req.user.id;
      const characterId = Number(req.params.characterId);
      const character = await characterService.getCharacterById(characterId, userId);

      if (!character || !character.imageUrl) return res.status(404).json({ error: 'Character or image not found' });

      if (!character.imageUrl.includes('placeholder.png')) {
        fs.unlinkSync(path.resolve('uploads', character.imageUrl));
      }

      await characterService.updateCharacterImage(characterId, userId, 'placeholder.png');
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async acquireSkill(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const { skillId } = req.params;
      const character = await characterSkillsService.acquireSkill(Number(skillId), userId);

      // Log skill acquisition
      AuditLogger.logEvent(
        AuditLogger.EventTypes.SKILL_ACQUIRE,
        {
          userId,
          characterId: character.id,
          req,
          riskLevel: AuditLogger.RiskLevels.LOW,
          details: { skill_id: Number(skillId) }
        }
      );
      
      res.status(200).json(character);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getAvailableSkills(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const { characterId } = req.params;
      const availableSkills = await characterSkillsService.getAvailableSkills(Number(characterId), userId);
      res.status(200).json(availableSkills);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get character stats with stat definition metadata
   */
  static async getCharacterStats(req, res) {
    try {
      const userId = req.user.id;
      const { characterId } = req.params;
      const characterStats = await characterStatsService.getCharacterStatsWithDefinitions(Number(characterId), userId);
      res.status(200).json(characterStats);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Update character stats
   */
  static async updateCharacterStats(req, res) {
    try {
      const userId = req.user.id;
      const { characterId } = req.params;
      const statUpdates = req.body;

      if (!statUpdates || typeof statUpdates !== 'object') {
        return res.status(400).json({ error: 'Stat updates must be provided as an object' });
      }

      const updatedCharacter = await characterStatsService.updateCharacterStats(
        Number(characterId), 
        userId, 
        statUpdates
      );
      
      // Log character stats update
      AuditLogger.logCharacter(
        AuditLogger.EventTypes.CHARACTER_STATS_UPDATE,
        userId,
        Number(characterId),
        req,
        { 
          updated_stats: Object.keys(statUpdates),
          stat_count: Object.keys(statUpdates).length
        }
      );
      
      res.status(200).json(updatedCharacter);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Reset character stats to defaults (useful for testing or character respec)
   */
  static async resetCharacterStats(req, res) {
    try {
      const userId = req.user.id;
      const { characterId } = req.params;
      
      const character = await characterService.getCharacterById(Number(characterId), userId);
      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      // Reset stats to race defaults
      const raceDefaults = character.race.statBonuses || {};
      const resetStats = {};
      
      // Get all stat definitions to know what stats exist
      const statDefinitions = await statDefinitionService.getAllStatDefinitions(null, true);

      for (const statDef of statDefinitions) {
        resetStats[statDef.internalName] = raceDefaults[statDef.internalName] || statDef.defaultValue || 0;
      }

      const updatedCharacter = await characterStatsService.updateCharacterStats(
        Number(characterId), 
        userId, 
        resetStats
      );
      res.status(200).json(updatedCharacter);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // NPC Management Methods (instance methods)
  async createNPC(req, res) {
    try {
      // Check if user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const npcData = req.body;
      const npc = await npcService.createNPC(npcData, req.user.id);
      res.status(201).json(npc);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllNPCs(req, res) {
    try {
      // Check if user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const npcs = await npcService.getAllNPCs();
      res.status(200).json(npcs);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateNPC(req, res) {
    try {
      // Check if user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { id } = req.params;
      const updateData = req.body;
      const updatedNPC = await npcService.updateNPC(Number(id), updateData);
      res.status(200).json(updatedNPC);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteNPC(req, res) {
    try {
      // Check if user has admin/master permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { id } = req.params;
      await npcService.deleteNPC(Number(id));
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAvailableNPCs(req, res) {
    try {
      const npcs = await npcService.getAvailableNPCs();
      res.status(200).json(npcs);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getActiveNPC(req, res) {
    try {
      const userId = req.user.id;
      const activeNPC = await npcService.getActiveNPCForUser(userId);
      res.status(200).json(activeNPC);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async activateNPC(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const activatedNPC = await npcService.activateNPC(Number(id), userId);
      res.status(200).json(activatedNPC);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deactivateNPC(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await npcService.deactivateNPC(Number(id), userId);
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCharacterById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const characterId = Number(id);
      
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID provided' });
      }

      const character = await characterService.getCharacterById(characterId, userId);
      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }

      res.status(200).json(character);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAcquiredSkills(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const characterId = Number(id);
      
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID provided' });
      }

      const skills = await characterSkillsService.getAcquiredSkills(characterId, userId);
      res.status(200).json(skills);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCharacterStatsWithDefinitions(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const characterId = Number(id);
      
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID provided' });
      }

      const characterStats = await characterStatsService.getCharacterStatsWithDefinitions(characterId, userId);
      res.status(200).json(characterStats);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  constructor() {
    // Bind instance methods to preserve 'this' context
    this.createNPC = this.createNPC.bind(this);
    this.getAllNPCs = this.getAllNPCs.bind(this);
    this.updateNPC = this.updateNPC.bind(this);
    this.deleteNPC = this.deleteNPC.bind(this);
  }
}
