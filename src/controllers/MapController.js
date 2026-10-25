import { MapService } from '../services/MapService.js';
import { LocationService } from '../services/LocationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { InputValidator } from '../utils/inputValidator.js';
import { HttpError } from '../utils/HttpError.js';
import { deleteUploadedFile, deleteImageFileIfUnreferenced } from '../utils/uploadedFiles.js';

const locationService = new LocationService();
const mapService = new MapService();

// The upload middleware already wrote the new file; when the request fails, nothing points at it.
const discardUpload = (file) => (file ? deleteUploadedFile(file.filename).catch(() => {}) : undefined);

export class MapController {
  static getAllMaps = asyncHandler(async (req, res) => {
    res.status(200).json(await mapService.getAllMaps());
  });

  static createMap = asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!req.file) {
      throw new HttpError(400, 'File upload failed. Please upload a valid image.');
    }
    let map;
    try {
      map = await mapService.createMap(name, `/uploads/${req.file.filename}`);
    } catch (error) {
      await discardUpload(req.file);
      throw error;
    }
    res.status(201).json(map);
  });

  static updateMap = asyncHandler(async (req, res) => {
    let result;
    try {
      const id = InputValidator.validateId(req.params.id);
      const { name } = req.body;
      const updatedFields = req.file ? { name, imageUrl: `/uploads/${req.file.filename}` } : { name };
      result = await mapService.updateMap(id, updatedFields);
    } catch (error) {
      await discardUpload(req.file);
      throw error;
    }
    await deleteImageFileIfUnreferenced(result.fileToDelete);

    res.status(200).json(result.map);
  });

  static deleteMap = asyncHandler(async (req, res) => {
    const id = InputValidator.validateId(req.params.id);
    const { fileToDelete } = await mapService.deleteMap(id);
    await deleteImageFileIfUnreferenced(fileToDelete);
    res.status(204).end();
  });

  static getMapById = asyncHandler(async (req, res) => {
    const id = InputValidator.validateId(req.params.id);
    res.status(200).json(await mapService.getMapById(id));
  });

  static getLocationsByMapId = asyncHandler(async (req, res) => {
    const id = InputValidator.validateId(req.params.id);
    res.status(200).json(await locationService.getLocationsByMapId(id));
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
    const id = InputValidator.validateId(req.params.id);
    await mapService.setMainMap(id);
    res.status(200).json({ message: 'Main map updated successfully' });
  });
}
