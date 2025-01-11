import { MapService } from '../src/services/MapService.js';
import { Map } from '../src/models/mapModel.js'; // Adjust the path as necessary

async function testGetMainMap() {
    
    const mapService = new MapService();
    const mainMap = await mapService.getMainMap();
    console.log('Main Map:', mainMap);
}

testGetMainMap().catch(console.error);