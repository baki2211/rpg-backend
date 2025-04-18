import { MapService } from '../services/MapService.js';
import { LocationService } from '../services/LocationService.js';

const locationService = new LocationService();
const mapService = new MapService();

export class MapController {
  static async getAllMaps(res) {
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
    const updatedMap = await mapService.updateMap(Number(id), mapData);
    if (!updatedMap) {
      res.status(404).json({ message: 'Map not found' });
      return;
    }
    res.status(200).json(updatedMap);
  }

    static async deleteMap(req, res) {
        const { id } = req.params;
        await mapService.deleteMap(Number(id));
        res.status(204).send();
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
