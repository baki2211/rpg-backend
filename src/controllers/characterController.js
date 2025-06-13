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
      const {characterId} = req.params;
      const id = Number(characterId);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid characterId provided' });
      }
  
      await characterService.activateCharacter(id, userId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error).message });
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
}
