import { MapService } from '../services/MapService.js';
import { LocationService } from '../services/LocationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import fs from 'fs';
import path from 'path';

const locationService = new LocationService();
const mapService = new MapService();

export class MapController {
  static getAllMaps = asyncHandler(async (req, res) => {
    res.status(200).json(await mapService.getAllMaps());
  });

  static createMap = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!req.file) {
      throw new HttpError(400, 'File upload failed. Please upload a valid image.');
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(201).json(await mapService.createMap(name, imageUrl));
  });

  static updateMap = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    const existingMap = await mapService.getMapById(Number(id));

    const updatedFields = { name };
    if (req.file) {
      if (existingMap.imageUrl && existingMap.imageUrl.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), existingMap.imageUrl);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.warn('Failed to delete old image:', err.message);
        });
      }
      updatedFields.imageUrl = `/uploads/${req.file.filename}`;
    }

    res.status(200).json(await mapService.updateMap(Number(id), updatedFields));
  });

  static deleteMap = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await mapService.deleteMap(Number(id));
    res.status(204).end();
  });

  static getMapById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
      throw new HttpError(400, 'Invalid map ID');
    }
    res.status(200).json(await mapService.getMapById(Number(id)));
  });

  static getLocationsByMapId = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
      throw new HttpError(400, 'Invalid map ID');
    }
    res.status(200).json(await locationService.getLocationsByMapId(Number(id)));
  });

  static getMainMap = asyncHandler(async (req, res) => {
    const mainMap = await mapService.getMainMap();
    if (!mainMap) {
      throw new HttpError(404, 'Main map not found');
    }
    const locations = await locationService.getLocationsByMapId(mainMap.id);
    res.status(200).json({ ...mainMap, locations });
  });

  static setMainMap = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await mapService.setMainMap(Number(id));
    res.status(200).json({ message: 'Main map updated successfully' });
  });
}
