import { AppDataSource } from '../data-source.js';
import { Race } from '../models/raceModel.js';
import staticDataCache from '../utils/staticDataCache.js';

export class RaceService {
    raceRepository = AppDataSource.getRepository(Race);

    async getAllRaces() {
        return staticDataCache.getRaces();
    }

    async getPlayableRaces() {
        const allRaces = await staticDataCache.getRaces();
        return allRaces.filter(race => race.isPlayable);
    }

    async getRaceById(id) {
        return staticDataCache.getRaceById(id);
    }

    async createRace(raceData) {
        const race = this.raceRepository.create(raceData);
        const savedRace = await this.raceRepository.save(race);
        staticDataCache.clearEntity('Race');
        return savedRace;
    }

    async updateRace(id, raceData) {
        const race = await this.raceRepository.findOne({ where: { id } });
        if (!race) return null;
        Object.assign(race, raceData);
        const savedRace = await this.raceRepository.save(race);
        staticDataCache.clearEntity('Race');
        return savedRace;
    }

    async deleteRace(id) {
        const race = await this.raceRepository.findOne({ where: { id } });
        if (!race) throw new Error('Race not found');
        await this.raceRepository.remove(race);
        staticDataCache.clearEntity('Race');
    }
}
