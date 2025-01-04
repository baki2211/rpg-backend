// src/services/RaceService.ts
import { AppDataSource } from '../data-source';
import { Race } from '../models/raceModel';

export class RaceService {
    private raceRepository = AppDataSource.getRepository(Race);

    async getAllRaces(): Promise<Race[]> {
        return this.raceRepository.find();
    }

    async getRaceById(id: number): Promise<Race | null> {
        return this.raceRepository.findOne({ where: { id } });
    }

    async createRace(raceData: Partial<Race>): Promise<Race> {
        const race = this.raceRepository.create(raceData);
        return this.raceRepository.save(race);
    }

    async updateRace(id: number, raceData: Partial<Race>): Promise<Race | null> {
        const race = await this.getRaceById(id);
        if (!race) return null;
        Object.assign(race, raceData); // Update fields dynamically
        return this.raceRepository.save(race);
    }

    async deleteRace(id: number): Promise<void> {
        const race = await this.getRaceById(id);
        if (!race) throw new Error('Race not found');
        await this.raceRepository.remove(race);
    }
}
