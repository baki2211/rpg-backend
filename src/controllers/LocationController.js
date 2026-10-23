import { LocationService } from '../services/LocationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';

const locationService = new LocationService();

export class LocationController {
  static getLocations = asyncHandler(async (req, res) => {
    const mapId = InputValidator.validateId(req.params.mapId);
    res.status(200).json(await locationService.getLocationsByMapId(mapId));
  });

  static createLocation = asyncHandler(async (req, res) => {
    const mapId = InputValidator.validateId(req.params.mapId);
    res.status(201).json(await locationService.createLocation(mapId, req.body));
  });

  static deleteLocation = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    await locationService.deleteLocation(locationId);
    res.status(200).json({ message: 'Location deleted successfully' });
  });

  static updateLocation = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    res.status(200).json(await locationService.updateLocation(locationId, req.body));
  });

  static getLocationById = asyncHandler(async (req, res) => {
    const locationId = InputValidator.validateLocationId(req.params.locationId);
    res.status(200).json(await locationService.getLocationById(locationId));
  });

  static getLocationByName = asyncHandler(async (req, res) => {
    const { name } = req.params;
    res.status(200).json(await locationService.getLocationByName(name));
  });
}
