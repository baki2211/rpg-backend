import { CharacterService } from '../services/CharacterService.js';

const characterService = new CharacterService();

export class CharacterController {
  static async createCharacter(req, res) {
    try {
      const userId = req.user.id; // From auth middleware
      const character = await characterService.createCharacter(req.body, userId);
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
      const { characterId } = req.params;
      await characterService.deleteCharacter(Number(characterId), userId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error).message });
    }
  }
}
