import { AppDataSource } from '../data-source.js';
import { Location } from '../models/locationModel.js';
import { HttpError } from '../utils/HttpError.js';

export class LocationService {
  locationRepository = AppDataSource.getRepository(Location);

  async getLocationsByMapId(mapId) {
    return this.locationRepository.find({
      where: { map: { id: mapId } },
    });
  }

  async createLocation(mapId, locationData) {
    const location = this.locationRepository.create({ ...locationData, map: { id: mapId } });
    return this.locationRepository.save(location);
  }

  async deleteLocation(locationId) {
    await this.locationRepository.delete(locationId);
  }

  async updateLocation(id, locationData) {
    const location = await this.locationRepository.findOne({ where: { id } });
    if (!location) throw new HttpError(404, 'Location not found');
    Object.assign(location, locationData);
    return this.locationRepository.save(location);
  }

  async getLocationById(id) {
    const location = await this.locationRepository.findOne({ where: { id } });
    if (!location) throw new HttpError(404, 'Location not found');
    return location;
  }

  async getLocationByName(name) {
    const location = await this.locationRepository.findOne({ where: { name } });
    if (!location) throw new HttpError(404, 'Location not found');
    return location;
  }
}
