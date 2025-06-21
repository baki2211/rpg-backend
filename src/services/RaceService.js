import { AppDataSource } from '../data-source.js';
import { Race } from '../models/raceModel.js';

export class RaceService {
    raceRepository = AppDataSource.getRepository(Race);

    async getAllRaces() {
        return this.raceRepository.find();
    }

    async getPlayableRaces() {
        return this.raceRepository.find({ 
            where: { isPlayable: true }
        });
    }

    async getRaceById(id) {
        return this.raceRepository.findOne({ where: { id } });
    }

    async createRace(raceData) {
        const race = this.raceRepository.create(raceData);
        return this.raceRepository.save(race);
    }

    async updateRace(id, raceData) {
        const race = await this.getRaceById(id);
        if (!race) return null;
        Object.assign(race, raceData); // Update fields dynamically
        return this.raceRepository.save(race);
    }

    async deleteRace(id) {
        const race = await this.getRaceById(id);
        if (!race) throw new Error('Race not found');
        await this.raceRepository.remove(race);
    }
}
