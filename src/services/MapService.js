import { AppDataSource } from '../data-source.js';
import { Map } from '../models/mapModel.js';
import fs from 'fs';
import path from 'path';


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
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) throw new Error('Map not found');
    if (map.isMainMap) {
      throw new Error('Cannot delete the main map');
    }
    const count = await this.mapRepository.count();
    if (count <= 1) {
      throw new Error('Cannot delete the only map');
    }
    if (map.imageUrl && map.imageUrl.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), map.imageUrl);
      fs.unlink(imagePath, (err) => {
        if (err) console.warn('Failed to delete image file:', err.message);
        else console.log('Deleted map image:', imagePath);
      });
    }
    return this.mapRepository.delete(id);
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
