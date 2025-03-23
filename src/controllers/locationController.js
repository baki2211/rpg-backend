import { LocationService } from '../services/LocationService.js';

const locationService = new LocationService();

export class LocationController {
  static async getLocations(req, res) {
    const { mapId } = req.params;
    const locations = await locationService.getLocationsByMapId(Number(mapId));
    res.status(200).json(locations);
  }

  static async createLocation(req, res) {
    const { mapId } = req.params;
    const locationData = req.body;
  
    if (!mapId || isNaN(Number(mapId))) {
      res.status(400).json({ message: 'Invalid map ID' });
      return;
    }
  
    try {
      const newLocation = await locationService.createLocation(Number(mapId), locationData);
      console.log('Location created:', newLocation);
      
      res.status(201).json(newLocation);
    } catch (error) {
      console.error('Error creating location:', error);
      res.status(500).json({ message: 'Error creating location' });
    }
  }
  
  static async deleteLocation(req, res) {
    const { locationId } = req.params;
  
    try {
      await locationService.deleteLocation(Number(locationId));
      res.status(200).json({ message: 'Location deleted successfully' });
    } catch (error) {
      console.error('Error deleting location:', error);
      res.status(500).json({ message: 'Failed to delete location' });
    }
  }
  
  static async updateLocation(req, res) {
    const { locationId } = req.params;
    const locationData = req.body;
  
    try {
      const updatedLocation = await locationService.updateLocation(Number(locationId), locationData);
      if (!updatedLocation) {
        res.status(404).json({ message: 'Location not found' });
        return;
      }
      res.status(200).json(updatedLocation);
    } catch (error) {
      console.error('Error updating location:', error);
      res.status(500).json({ message: 'Failed to update location' });
    }
  }
  
    static async getLocationById(req, res) {
        const { locationId } = req.params;
        const location = await locationService.getLocationById(Number(locationId));
        if (!location) {
            res.status(404).json({ message: 'Location not found' });
            return;
        }
        res.status(200).json(location);
    }

    static async getLocationByName(req, res) {
        const { name } = req.params;
        const location = await locationService.getLocationByName(name);
        if (!location) {
            res.status(404).json({ message: 'Location not found' });
            return;
        }
        res.status(200).json(location);
    }

}
