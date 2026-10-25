import { AppDataSource } from '../data-source.js';
import { Map } from '../models/mapModel.js';
import { HttpError } from '../utils/HttpError.js';
import { lockImageFiles, isImageUrlReferenced } from '../utils/uploadedFiles.js';
import { imageFileToDelete } from '../domain/character/characterImage.js';

// Map images live in uploads/ like character portraits and follow the same rules: the file is
// deleted only after the change committed (the caller runs deleteImageFileIfUnreferenced on
// `fileToDelete`), and only when no character or map points at it any more.

export class MapService {
  mapRepository = AppDataSource.getRepository(Map);

  async getAllMaps() {
    return this.mapRepository.find();
  }

  async createMap(name, imageUrl) {
    return AppDataSource.transaction(async (manager) => {
      await lockImageFiles(manager, [imageUrl]);
      const repository = manager.getRepository(Map);
      return repository.save(repository.create({ name, imageUrl }));
    });
  }

  /**
   * @returns {Promise<{ map: Object, fileToDelete: string|null }>} fileToDelete: the replaced image's
   *   file, when nothing else uses it
   */
  async updateMap(id, mapData) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Map);
      const map = await repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!map) throw new HttpError(404, 'Map not found');

      const previousUrl = map.imageUrl;
      await lockImageFiles(manager, [previousUrl, mapData.imageUrl]);
      Object.assign(map, mapData);
      const saved = await repository.save(map);

      // Runs after the save: an unchanged URL is still referenced by this map and is kept.
      return { map: saved, fileToDelete: imageFileToDelete(previousUrl, await isImageUrlReferenced(manager, previousUrl)) };
    });
  }

  /**
   * @returns {Promise<{ fileToDelete: string|null }>} The deleted map's image file, when nothing else uses it
   */
  async deleteMap(id) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Map);
      const map = await repository.findOne({ where: { id } });
      if (!map) throw new HttpError(404, 'Map not found');
      if (map.isMainMap) {
        throw new HttpError(409, 'Cannot delete the main map');
      }
      const count = await repository.count();
      if (count <= 1) {
        throw new HttpError(409, 'Cannot delete the only map');
      }

      await lockImageFiles(manager, [map.imageUrl]);
      await repository.delete(id);
      return { fileToDelete: imageFileToDelete(map.imageUrl, await isImageUrlReferenced(manager, map.imageUrl)) };
    });
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
