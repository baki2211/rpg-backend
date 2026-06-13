import { AppDataSource } from '../data-source.js';
import { Map } from '../models/mapModel.js';
import { HttpError } from '../utils/HttpError.js';
import fs from 'fs';
import path from 'path';

export class MapService {
  mapRepository = AppDataSource.getRepository(Map);

  async getAllMaps() {
    return this.mapRepository.find();
  }

  async createMap(name, imageUrl) {
    const newMap = this.mapRepository.create({ name, imageUrl });
    return this.mapRepository.save(newMap);
  }

  async updateMap(id, mapData) {
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) throw new HttpError(404, 'Map not found');
    Object.assign(map, mapData);
    return this.mapRepository.save(map);
  }

  async deleteMap(id) {
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) throw new HttpError(404, 'Map not found');
    if (map.isMainMap) {
      throw new HttpError(409, 'Cannot delete the main map');
    }
    const count = await this.mapRepository.count();
    if (count <= 1) {
      throw new HttpError(409, 'Cannot delete the only map');
    }
    if (map.imageUrl && map.imageUrl.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), map.imageUrl);
      fs.unlink(imagePath, (err) => {
        if (err) console.warn('Failed to delete image file:', err.message);
      });
    }
    return this.mapRepository.delete(id);
  }

  async getMapById(id) {
    const map = await this.mapRepository.findOne({ where: { id } });
    if (!map) throw new HttpError(404, 'Map not found');
    return map;
  }

  async getMainMap() {
    return this.mapRepository.findOne({
      where: { isMainMap: true },
      select: { id: true, name: true, imageUrl: true, isMainMap: true },
    });
  }

  async setMainMap(id) {
    await this.mapRepository.update({}, { isMainMap: false });
    await this.mapRepository.update({ id }, { isMainMap: true });
  }
}
