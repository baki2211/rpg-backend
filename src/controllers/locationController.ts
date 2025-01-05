import { Request, Response } from 'express';
import { LocationService } from '../services/LocationService.js';

const locationService = new LocationService();

export class LocationController {
  static async getLocations(req: Request, res: Response): Promise<void> {
    const { mapId } = req.params;
    const locations = await locationService.getLocationsByMap(Number(mapId));
    res.status(200).json(locations);
  }

  static async createLocation(req: Request, res: Response): Promise<void> {
    const { mapId } = req.params;
    const locationData = req.body;
    const newLocation = await locationService.createLocation(Number(mapId), locationData);
    res.status(201).json(newLocation);
  }

  static async deleteLocation(req: Request, res: Response): Promise<void> {
    const { locationId } = req.params;
    await locationService.deleteLocation(Number(locationId));
    res.status(200).json({ message: 'Location deleted successfully' });
  }

    static async updateLocation(req: Request, res: Response): Promise<void> {
        const { locationId } = req.params;
        const locationData = req.body;
        const updatedLocation = await locationService.updateLocation(Number(locationId), locationData);
        res.status(200).json(updatedLocation);
    }

    static async getLocationById(req: Request, res: Response): Promise<void> {
        const { locationId } = req.params;
        const location = await locationService.getLocationById(Number(locationId));
        if (!location) {
            res.status(404).json({ message: 'Location not found' });
            return;
        }
        res.status(200).json(location);
    }

    static async getLocationByName(req: Request, res: Response): Promise<void> {
        const { name } = req.params;
        const location = await locationService.getLocationByName(name);
        if (!location) {
            res.status(404).json({ message: 'Location not found' });
            return;
        }
        res.status(200).json(location);
    }

}
