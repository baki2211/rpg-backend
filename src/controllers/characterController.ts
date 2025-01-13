import { Request, Response } from 'express';
import { CharacterService } from '../services/CharacterService.js';

const characterService = new CharacterService();

export class CharacterController {
  static async createCharacter(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id; // From auth middleware
      const character = await characterService.createCharacter(req.body, userId);
      res.status(201).json(character);
    } catch (error: any) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async getCharacters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id; // From auth middleware
      const characters = await characterService.getCharactersByUser(userId);
      res.status(200).json(characters);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async activateCharacter(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id; // From auth middleware
      const { characterId } = req.params;
      await characterService.activateCharacter(Number(characterId), userId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  static async deleteCharacter(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user.id; // From auth middleware
      const { characterId } = req.params;
      await characterService.deleteCharacter(Number(characterId), userId);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
