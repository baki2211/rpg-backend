import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';

export class CharacterService {
  private characterRepository = AppDataSource.getRepository(Character);
  private userRepository = AppDataSource.getRepository(User);

  async createCharacter(data: Partial<Character>, userId: number): Promise<Character> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }

    // Validate pool of 45 points for stats
    const totalStats = Object.values(data.stats || {}).reduce((sum, val) => sum + val, 0);
    if (totalStats > 45) {
      throw new Error('Total stats exceed the allowed 45 points.');
    }

    // Set all other characters for the user as inactive if this one is active
    if (data.isActive) {
      await this.characterRepository.update({ user: { id: userId } }, { isActive: false });
    }

    // Create the new character, using lazy loading for `user`
    const newCharacter = this.characterRepository.create({
      ...data,
      user: Promise.resolve(user.id), // Wrap `user` in a `Promise` to satisfy lazy loading
    });

    return this.characterRepository.save(newCharacter);
  }

  async getCharactersByUser(userId: number): Promise<Character[]> {
    return this.characterRepository.find({
      where: { user: { id: userId } },
      relations: ['race'], // Load the race relation explicitly
    });
  }

  async activateCharacter(characterId: number, userId: number): Promise<void> {
    // Deactivate all characters first
    await this.characterRepository.update({ user: { id: userId } }, { isActive: false });

    // Activate the chosen character
    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { isActive: true }
    );
  }

  async deleteCharacter(characterId: number, userId: number): Promise<void> {
    await this.characterRepository.delete({ id: characterId, user: { id: userId } });
  }
}
