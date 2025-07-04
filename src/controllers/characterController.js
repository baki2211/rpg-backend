import { CharacterService } from '../services/CharacterService.js';
import fs from 'fs';
import path from 'path';

const characterService = new CharacterService();

export class CharacterController {
  static async createCharacter(req, res) {
    if (!req.body) {
      return res.status(400).json({ error: 'No character data provided' });
    }
    try {
      const userId = req.user.id; // From auth middleware
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.jpg';
      const character = await characterService.createCharacter(req.body, userId, imageUrl);
      res.status(201).json(character);
    } catch (error) {
      res.status(400).json({ error: (error).message });
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
      const userId = req.user.id; // From auth middleware
      const { id } = req.params; // Route parameter is 'id', not 'characterId'
      const characterId = Number(id);
      if (isNaN(characterId)) {
        return res.status(400).json({ error: 'Invalid character ID provided' });
      }
  
      await characterService.activateCharacter(characterId, userId);
      res.status(204).send();
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
      res.status(204).send();
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
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async acquireSkill(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const { skillId } = req.params;
      const character = await characterService.acquireSkill(Number(skillId), userId);
      res.status(200).json(character);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getAvailableSkills(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const { characterId } = req.params;
      const availableSkills = await characterService.getAvailableSkills(Number(characterId), userId);
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
      const characterStats = await characterService.getCharacterStatsWithDefinitions(Number(characterId), userId);
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

      const updatedCharacter = await characterService.updateCharacterStats(
        Number(characterId), 
        userId, 
        statUpdates
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
      const statDefinitions = await characterService.getStatDefinitions();
      
      for (const statDef of statDefinitions) {
        resetStats[statDef.name] = raceDefaults[statDef.name] || statDef.defaultValue || 0;
      }

      const updatedCharacter = await characterService.updateCharacterStats(
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
      const npc = await characterService.createNPC(npcData);
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

      const npcs = await characterService.getAllNPCs();
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
      const updatedNPC = await characterService.updateNPC(Number(id), updateData);
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
      await characterService.deleteNPC(Number(id));
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAvailableNPCs(req, res) {
    try {
      const npcs = await characterService.getAvailableNPCs();
      res.status(200).json(npcs);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getActiveNPC(req, res) {
    try {
      const userId = req.user.id;
      const activeNPC = await characterService.getActiveNPCForUser(userId);
      res.status(200).json(activeNPC);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async activateNPC(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const activatedNPC = await characterService.activateNPC(Number(id), userId);
      res.status(200).json(activatedNPC);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deactivateNPC(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      await characterService.deactivateNPC(Number(id), userId);
      res.status(204).send();
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

      const skills = await characterService.getAcquiredSkills(characterId, userId);
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

      const characterStats = await characterService.getCharacterStatsWithDefinitions(characterId, userId);
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
