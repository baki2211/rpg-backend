import { MapService } from '../services/MapService.js';
import { LocationService } from '../services/LocationService.js';
import fs from 'fs';
import path from 'path';

const locationService = new LocationService();
const mapService = new MapService();

export class MapController {
  static async getAllMaps(req, res) {
    const maps = await mapService.getAllMaps();
    res.status(200).json(maps);
  }

  static async createMap(req, res) {
    const { name } = req.body;

    if (!req.file) {
        res.status(400).json({ message: 'File upload failed. Please upload a valid image.' });
        return;
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    try {
        const newMap = await mapService.createMap(name, imageUrl);
        res.status(201).json(newMap);
    } catch (error) {
        const errorMessage = (error).message;
        res.status(500).json({ message: 'Error creating map', error: errorMessage });
    }
}


  static async updateMap(req, res) {
    const { id } = req.params;
    const mapData = req.body;
  // const updatedMap = await mapService.updateMap(Number(id), mapData);
  //   if (!updatedMap) {
  //     res.status(404).json({ message: 'Map not found' });
  //     return;
  //   }
  //   res.status(200).json(updatedMap);
  try {
    const existingMap = await mapService.getMapById(Number(id));
    if (!existingMap) {
      return res.status(404).json({ message: 'Map not found' });
    }

    const updatedFields = { name };

    if (req.file) {
      // Delete old image file if it exists and is local (basic protection)
      if (existingMap.imageUrl && existingMap.imageUrl.startsWith('/uploads/')) {
        const oldImagePath = path.join(process.cwd(), existingMap.imageUrl);
        fs.unlink(oldImagePath, (err) => {
          if (err) console.warn('⚠️ Failed to delete old image:', err.message);
          else console.log('🗑️ Old image deleted:', oldImagePath);
        });
      }
     // Add new image path
     updatedFields.imageUrl = `/uploads/${req.file.filename}`;
    }

    const updatedMap = await mapService.updateMap(Number(id), updatedFields);
    res.status(200).json(updatedMap);
  } catch (error) {
    console.error('Error updating map:', error);
    res.status(500).json({ message: 'Failed to update map', error: error.message });
  }
}

    static async deleteMap(req, res) {
        const { id } = req.params;
        try {
          await mapService.deleteMap(Number(id));
          res.status(204).send();
        } catch (error) {
          res.status(400).json({ message: error.message });
        }
    }

    static async getMapById(req, res) {
      const { id } = req.params;
      if (!id || isNaN(Number(id))) {
        res.status(400).json({ message: 'Invalid map ID' });
        return;
      }
    
      try {
        const map = await mapService.getMapById(Number(id));
        if (!map) {
          res.status(404).json({ message: 'Map not found' });
          return;
        }
        res.status(200).json(map);
      } catch (error) {
        const errorMessage = (error).message;
        res.status(500).json({ message: 'Error fetching map', error: errorMessage });
      }
    }

    //testing getLocationsByMapId
    static async getLocationsByMapId(req, res) {
      const { id } = req.params;
  
      if (!id || isNaN(Number(id))) {
        res.status(400).json({ message: 'Invalid map ID' });
        return;
      }
  
      try {
        const locations = await locationService.getLocationsByMapId(Number(id));
        res.status(200).json(locations);
      } catch (error) {
        const errorMessage = (error).message;
        res.status(500).json({ message: 'Error fetching locations', error: errorMessage });
      }
    }
    
    static async getMainMap(req, res) {
      try {
        const mainMap = await mapService.getMainMap();
        if (!mainMap) {
          res.status(400).json({ message: 'Main map not found' });
          return;
        }
        // Fetch associated locations if they exist
        const locations = await locationService.getLocationsByMapId(mainMap.id);
    
        res.status(200).json({ ...mainMap, locations });
      } catch (error) {
        console.error('Error fetching main map:', error);
        res.status(500).json({ message: 'Failed to fetch main map', error: (error).message });
      }
    }
    
    static async setMainMap(req, res) {
      const { id } = req.params;
      try {
        await mapService.setMainMap(Number(id));
        res.status(200).json({ message: 'Main map updated successfully' });
      } catch (error) {
        const errorMessage = (error).message;
        res.status(500).json({ message: 'Error updating main map', error: errorMessage });
      }
    }


}
