require('reflect-metadata');
const bcrypt = require('bcrypt');
const { AppDataSource } = require('./data-source.js');
const { User } = require('./models/userModel.js');
const { Race } = require('./models/raceModel.js');
const { Map } = require('./models/mapModel.js');
const { Location } = require('./models/locationModel.js');

async function seed() {
  try {
    await AppDataSource.initialize();

    const userRepo = AppDataSource.getRepository(User);
    const raceRepo = AppDataSource.getRepository(Race);
    const mapRepo = AppDataSource.getRepository(Map);
    const locationRepo = AppDataSource.getRepository(Location);

    const userCount = await userRepo.count();
    if (userCount > 0) {
      console.log('Seed data already exists. Skipping...');
      return;
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    await userRepo.save([
      userRepo.create({ username: 'admin', password: passwordHash, role: 'admin' }),
      userRepo.create({ username: 'user', password: passwordHash, role: 'user' })
    ]);

    const race = raceRepo.create({
      name: 'Human',
      description: 'Balanced default race.',
      healthBonus: 5,
      manaBonus: 5,
      strengthBonus: 2,
      agilityBonus: 2,
      intelligenceBonus: 2,
      speedBonus: 2,
      armorBonus: 2
    });
    await raceRepo.save(race);

    const map = mapRepo.create({
      name: 'Main',
      imageUrl: '/uploads/1746351601017-486054461-1745352337710-226738127-v2hg7xy9ty811.jpg',
      isMainMap: true
    });
    await mapRepo.save(map);

    const location = locationRepo.create({
      name: 'Starting Village',
      description: 'The place where all adventures begin.',
      xCoordinate: 55,
      yCoordinate: 35,
      map: 1 
    });
    await locationRepo.save(location);

    console.log('Seed data inserted successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();
