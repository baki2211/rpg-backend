import { AppDataSource } from '../data-source.js';
import { Race } from '../models/raceModel.js';
import staticDataCache from '../utils/staticDataCache.js';
import { HttpError } from '../utils/HttpError.js';

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
        const race = await staticDataCache.getRaceById(id);
        if (!race) throw new HttpError(404, 'Race not found');
        return race;
    }

    async createRace(raceData) {
        const race = this.raceRepository.create(raceData);
        const savedRace = await this.raceRepository.save(race);
        staticDataCache.clearEntity('Race');
        return savedRace;
    }

    async updateRace(id, raceData) {
        const race = await this.raceRepository.findOne({ where: { id } });
        if (!race) throw new HttpError(404, 'Race not found');
        Object.assign(race, raceData);
        const savedRace = await this.raceRepository.save(race);
        staticDataCache.clearEntity('Race');
        return savedRace;
    }

    async deleteRace(id) {
        const race = await this.raceRepository.findOne({ where: { id } });
        if (!race) throw new HttpError(404, 'Race not found');
        await this.raceRepository.remove(race);
        staticDataCache.clearEntity('Race');
    }
}
