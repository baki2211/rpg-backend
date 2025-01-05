import { AppDataSource } from '../data-source.js';
import { Map } from '../models/mapModel.js';

export class MapService {
  private mapRepository = AppDataSource.getRepository(Map);

  async getAllMaps(): Promise<Map[]> {
    return this.mapRepository.find();
  }

  async createMap(name: string, imageUrl: string): Promise<Map> {
    const newMap = this.mapRepository.create({
        name,
        imageUrl,
    });
    return this.mapRepository.save(newMap);
}


  async updateMap(id: number, mapData: Partial<Map>): Promise<Map | null> {
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) return null;
    Object.assign(map, mapData); // Update fields dynamically
    return this.mapRepository.save(map);
  }
    
    async deleteMap(id: number): Promise<void> {
        await this.mapRepository.delete(id);
    }

    async getMapById(id: number): Promise<Map | null> {
        return this.mapRepository.findOne({ where: { id } });
    }

}
