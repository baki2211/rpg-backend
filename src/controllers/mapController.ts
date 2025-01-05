import { Request, Response, } from 'express';
import { MapService } from '../services/MapService.js';

const mapService = new MapService();

export class MapController {
  static async getAllMaps(req: Request, res: Response): Promise<void> {
    const maps = await mapService.getAllMaps();
    res.status(200).json(maps);
  }

  static async createMap(req: Request, res: Response): Promise<void> {
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
        const errorMessage = (error as Error).message;
        res.status(500).json({ message: 'Error creating map', error: errorMessage });
    }
}


  static async updateMap(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const mapData = req.body;
    const updatedMap = await mapService.updateMap(Number(id), mapData);
    if (!updatedMap) {
      res.status(404).json({ message: 'Map not found' });
      return;
    }
    res.status(200).json(updatedMap);
  }

    static async deleteMap(req: Request, res: Response): Promise<void> {
        const { id } = req.params;
        await mapService.deleteMap(Number(id));
        res.status(204).send();
    }

    static async getMapById(req: Request, res: Response): Promise<void> {
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
        const errorMessage = (error as Error).message;
        res.status(500).json({ message: 'Error fetching map', error: errorMessage });
      }
    }
    
    static async getMainMap(req: Request, res: Response): Promise<void> {
      try {
        const mainMap = await mapService.getMainMap();
        if (!mainMap) {
          res.status(404).json({ message: 'Main map not found' });
          return;
        }
        res.status(200).json(mainMap);
      } catch (error) {
        console.error('Error fetching main map:', error);
        res.status(500).json({ message: 'Error fetching main map' });
      }
    }
    
    

    static async setMainMap(req: Request, res: Response): Promise<void> {
      const { id } = req.params;
      try {
        await mapService.setMainMap(Number(id));
        res.status(200).json({ message: 'Main map updated successfully' });
      } catch (error) {
        const errorMessage = (error as Error).message;
        res.status(500).json({ message: 'Error updating main map', error: errorMessage });
      }
    }


}
