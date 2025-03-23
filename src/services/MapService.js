import { AppDataSource } from '../data-source.js';
import { Map } from '../models/mapModel.js';


export class MapService {
  mapRepository = AppDataSource.getRepository(Map);

  async getAllMaps() {
    return this.mapRepository.find();
  }

  async createMap(name, imageUrl) {
    const newMap = this.mapRepository.create({
        name,
        imageUrl,
    });
    return this.mapRepository.save(newMap);
}


  async updateMap(id, mapData) {
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) return null;
    Object.assign(map, mapData); // Update fields dynamically
    return this.mapRepository.save(map);
  }
    
    async deleteMap(id) {
        await this.mapRepository.delete(id);
    }

    async getMapById(id) {
        return this.mapRepository.findOne({ where: { id } });
    }

    async getMainMap() {
      console.log('Fetching main map from database');
      return this.mapRepository.findOne({
        where: { isMainMap: true },
        select: ['id', 'name', 'imageUrl', 'isMainMap'], 
      });
    }     

    async setMainMap(id) {
      // Reset isMainMap for all maps
      await this.mapRepository.update({}, { isMainMap: false });
      // Set isMainMap for the selected map
      await this.mapRepository.update({ id }, { isMainMap: true });
    }

}
