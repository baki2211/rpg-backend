import { AppDataSource } from '../data-source.js';
import { Location } from '../models/locationModel.js';

export class LocationService {
  locationRepository = AppDataSource.getRepository(Location);

  async getLocationsByMapId(mapId) {
    return this.locationRepository.find({
      where: { map: { id: mapId } }, // Fetch locations where the map's ID matches
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
    if (!location) return null;
    Object.assign(location, locationData); // Update fields dynamically
    return this.locationRepository.save(location);
  }

    async getLocationById(id) {
        return this.locationRepository.findOne({ where: { id } });
    }

    async getLocationByName(name) {
        return this.locationRepository.findOne({ where: { name } });
    }
}
