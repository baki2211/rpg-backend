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

      // Initialize stats with defaults
      const defaultStats = await characterService.initializeCharacterStats({});
      const updatedCharacter = await characterService.updateCharacterStats(
        Number(characterId), 
        userId, 
        defaultStats
      );
      
      res.status(200).json(updatedCharacter);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Create an NPC character (admin/master only)
   */
  async createNPC(req, res) {
    try {
      // Check permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

             const npc = await this.characterService.createNPC(req.body, req.user.id, req.body.imageUrl);
      res.status(201).json(npc);
    } catch (error) {
      console.error('Error creating NPC:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get all NPCs (admin/master only)
   */
  async getAllNPCs(req, res) {
    try {
      // Check permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

             const npcs = await this.characterService.getAllNPCs();
      res.json(npcs);
    } catch (error) {
      console.error('Error fetching NPCs:', error);
      res.status(500).json({ error: 'Failed to fetch NPCs' });
    }
  }

  /**
   * Update an NPC character (admin/master only)
   */
  async updateNPC(req, res) {
    try {
      // Check permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { id } = req.params;
             const updatedNPC = await this.characterService.updateNPC(parseInt(id), req.body);
      res.json(updatedNPC);
    } catch (error) {
      console.error('Error updating NPC:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Delete an NPC character (admin/master only)
   */
  async deleteNPC(req, res) {
    try {
      // Check permissions
      if (!['admin', 'master'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Admin or Master access required' });
      }

      const { id } = req.params;
             await this.characterService.deleteNPC(parseInt(id));
      res.json({ message: 'NPC deleted successfully' });
    } catch (error) {
      console.error('Error deleting NPC:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get available NPCs for activation
   */
  async getAvailableNPCs(req, res) {
    try {
             const npcs = await this.characterService.getAvailableNPCs();
      res.json(npcs);
    } catch (error) {
      console.error('Error fetching available NPCs:', error);
      res.status(500).json({ error: 'Failed to fetch available NPCs' });
    }
  }

  /**
   * Get the active NPC for the current user
   */
  async getActiveNPC(req, res) {
    try {
      const userId = req.user.id;
      const activeNPC = await this.characterService.getActiveNPCForUser(userId);
      res.json(activeNPC);
    } catch (error) {
      console.error('Error fetching active NPC:', error);
      res.status(500).json({ error: 'Failed to fetch active NPC' });
    }
  }

  /**
   * Activate an NPC for the current user
   */
  async activateNPC(req, res) {
    try {
      const { id } = req.params;
             const activatedNPC = await this.characterService.activateNPC(parseInt(id), req.user.id);
      res.json(activatedNPC);
    } catch (error) {
      console.error('Error activating NPC:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Deactivate an NPC for the current user
   */
  async deactivateNPC(req, res) {
    try {
      const { id } = req.params;
      await this.characterService.deactivateNPC(parseInt(id), req.user.id);
      res.json({ message: 'NPC deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating NPC:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get character by ID (instance method)
   */
  async getCharacterById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const character = await this.characterService.getCharacterById(parseInt(id), userId);
      
      if (!character) {
        return res.status(404).json({ error: 'Character not found' });
      }
      
      res.json(character);
    } catch (error) {
      console.error('Error fetching character:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get acquired skills for a character (instance method)
   */
  async getAcquiredSkills(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const skills = await this.characterService.getAcquiredSkills(parseInt(id), userId);
      res.json(skills);
    } catch (error) {
      console.error('Error fetching acquired skills:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get character stats with definitions (instance method)
   */
  async getCharacterStatsWithDefinitions(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const characterStats = await this.characterService.getCharacterStatsWithDefinitions(parseInt(id), userId);
      res.json(characterStats);
    } catch (error) {
      console.error('Error fetching character stats:', error);
      res.status(400).json({ error: error.message });
    }
  }

  constructor() {
    this.characterService = new CharacterService();
  }
}
