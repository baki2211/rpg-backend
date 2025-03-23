import { AppDataSource } from '../data-source.js';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';

export class CharacterService {
  characterRepository = AppDataSource.getRepository(Character);
  userRepository = AppDataSource.getRepository(User);

  async createCharacter(data, userId) {
    const user = await this.userRepository.findOneBy({ id: (await data.user)?.id || userId });
    if (!user) {
      throw new Error('User not found');
    }
    //const raceId = Number(data.race?.id); // Ensure raceId is a number
    const race = await AppDataSource.getRepository(Race).findOneBy({ id: data.race?.id });
    console.log('Race Log:', race);
    if (!race) {
      throw new Error('Race not found');
    }
    // Validate pool of 45 points for stats
    const totalStats = Object.values(data.stats || {}).reduce((sum, val) => sum + val, 0);
    if (totalStats > 45) {
      throw new Error('Total stats exceed the allowed 45 points.');
    }

    // Set all other characters for the user as inactive if this one is active
    if (data.isActive) {
      await this.characterRepository.update({ user }, { isActive: false });
    }

    // Create the new character, using lazy loading for `user`
    const newCharacter = this.characterRepository.create({
      ...data,
      user: user,
      userId: user.id,
      race,
    });

    console.log('Creating character for user:', user);
    console.log('Character data:', data);

    return this.characterRepository.save(newCharacter);
  }

  async getCharactersByUser(userId) {
    return this.characterRepository.find({
      where: { user: { id: userId } },
      relations: ['race'], // Load the race relation explicitly
    });
  }

  async activateCharacter(characterId, userId) {
    // Deactivate all characters first
    await this.characterRepository.update({ user: { id: userId } }, { isActive: false });

    // Activate the chosen character
    await this.characterRepository.update(
      { id: characterId, user: { id: userId } },
      { isActive: true }
    );
  }

  async deleteCharacter(characterId, userId) {
    await this.characterRepository.delete({ id: characterId, user: { id: userId } });
  }
}
