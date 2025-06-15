import 'reflect-metadata';
import { AppDataSource } from './src/data-source.js';
import { Map } from './src/models/mapModel.js';
import { Character } from './src/models/characterModel.js';

async function fixPlaceholders() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const mapRepo = AppDataSource.getRepository(Map);
    const characterRepo = AppDataSource.getRepository(Character);

    // Fix map placeholder
    console.log('Updating map placeholder images...');
    const maps = await mapRepo.find();
    
    for (const map of maps) {
      // If the imageUrl points to a non-existent file or is the old seeded path, update it
      if (map.imageUrl && (
        map.imageUrl.includes('1746351601017-486054461-1745352337710-226738127-v2hg7xy9ty811.jpg') ||
        !map.imageUrl.startsWith('/uploads/map-placeholder.jpg')
      )) {
        await mapRepo.update(map.id, { imageUrl: '/uploads/map-placeholder.jpg' });
        console.log(`Updated map "${map.name}" to use map-placeholder.jpg`);
      }
    }

    // Fix character placeholders
    console.log('Updating character placeholder images...');
    const characters = await characterRepo.find();
    
    for (const character of characters) {
      // If character has no imageUrl or points to non-existent file, set to placeholder
      if (!character.imageUrl || character.imageUrl === 'placeholder.png') {
        await characterRepo.update(character.id, { imageUrl: '/uploads/placeholder.jpg' });
        console.log(`Updated character "${character.name}" to use placeholder.jpg`);
      }
    }

    console.log('Placeholder images updated successfully!');
  } catch (error) {
    console.error('Error fixing placeholders:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

fixPlaceholders(); 