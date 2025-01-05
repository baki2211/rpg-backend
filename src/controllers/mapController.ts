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
    const file = req.file;

    if (!name || !file) {
        res.status(400).json({ message: 'Name and image are required' });
        return;
    }

    const imageUrl = `/uploads/${file.filename}`; // Save the image URL

    try {
        const newMap = await mapService.createMap(name, imageUrl);
        res.status(201).json(newMap);
    } catch (error) {
        console.error('Error creating map:', error);
        res.status(500).json({ message: 'Error creating map', error });
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
        const map = await mapService.getMapById(Number(id));
        if (!map) {
            res.status(404).json({ message: 'Map not found' });
            return;
        }
        res.status(200).json(map);
    }


}
