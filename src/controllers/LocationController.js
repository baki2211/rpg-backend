import { LocationService } from '../services/LocationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';

const locationService = new LocationService();

export class LocationController {
  static getLocations = asyncHandler(async (req, res) => {
    const { mapId } = req.params;
    res.status(200).json(await locationService.getLocationsByMapId(Number(mapId)));
  });

  static createLocation = asyncHandler(async (req, res) => {
    const { mapId } = req.params;
    if (!mapId || isNaN(Number(mapId))) {
      throw new HttpError(400, 'Invalid map ID');
    }
    res.status(201).json(await locationService.createLocation(Number(mapId), req.body));
  });

  static deleteLocation = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    await locationService.deleteLocation(Number(locationId));
    res.status(200).json({ message: 'Location deleted successfully' });
  });

  static updateLocation = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    res.status(200).json(await locationService.updateLocation(Number(locationId), req.body));
  });

  static getLocationById = asyncHandler(async (req, res) => {
    const { locationId } = req.params;
    res.status(200).json(await locationService.getLocationById(Number(locationId)));
  });

  static getLocationByName = asyncHandler(async (req, res) => {
    const { name } = req.params;
    res.status(200).json(await locationService.getLocationByName(name));
  });
}
