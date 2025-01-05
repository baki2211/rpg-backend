import { AppDataSource } from '../data-source.js';
import { Location } from '../models/locationModel.js';

export class LocationService {
  private locationRepository = AppDataSource.getRepository(Location);

  async getLocationsByMap(mapId: number): Promise<Location[]> {
    return this.locationRepository.find({ where: { map: { id: mapId } } });
  }

  async createLocation(mapId: number, locationData: Partial<Location>): Promise<Location> {
    const location = this.locationRepository.create({ ...locationData, map: { id: mapId } });
    return this.locationRepository.save(location);
  }

  async deleteLocation(locationId: number): Promise<void> {
    await this.locationRepository.delete(locationId);
  }

  async updateLocation(id: number, locationData: Partial<Location>): Promise<Location | null> {
    const location = await this.locationRepository.findOne({ where: { id } });
    if (!location) return null;
    Object.assign(location, locationData); // Update fields dynamically
    return this.locationRepository.save(location);
  }

    async getLocationById(id: number): Promise<Location | null> {
        return this.locationRepository.findOne({ where: { id } });
    }

    async getLocationByName(name: string): Promise<Location | null> {
        return this.locationRepository.findOne({ where: { name } });
    }
}
