import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from './data-source.js';
import { User } from './models/userModel.js';
import { Race } from './models/raceModel.js';
import { Map } from './models/mapModel.js';
import { Location } from './models/locationModel.js';
import { Skill } from './models/skillModel.js';
import { Character } from './models/characterModel.js';
import { CharacterSkill } from './models/characterSkillModel.js';

async function seed() {
  try {
    await AppDataSource.initialize();

    const userRepo = AppDataSource.getRepository(User);
    const raceRepo = AppDataSource.getRepository(Race);
    const mapRepo = AppDataSource.getRepository(Map);
    const locationRepo = AppDataSource.getRepository(Location);
    const skillRepo = AppDataSource.getRepository(Skill);
    const characterRepo = AppDataSource.getRepository(Character);
    const characterSkillRepo = AppDataSource.getRepository(CharacterSkill);

    const userCount = await userRepo.count();
    if (userCount > 0) {
      console.log('Seed data already exists. Skipping...');
      return;
    }

    const passwordHash = await bcrypt.hash('password123', 10);

    // Create users
    const [admin, user] = await userRepo.save([
      userRepo.create({ username: 'admin', password: passwordHash, role: 'admin' }),
      userRepo.create({ username: 'user', password: passwordHash, role: 'user' })
    ]);

    // Create race
    const race = await raceRepo.save(raceRepo.create({
      name: 'Human',
      description: 'Balanced default race.',
      healthBonus: 5,
      manaBonus: 5,
      strengthBonus: 2,
      agilityBonus: 2,
      intelligenceBonus: 2,
      speedBonus: 2,
      armorBonus: 2
    }));

    // Create map and location
    const map = await mapRepo.save(mapRepo.create({
      name: 'Main',
      imageUrl: '/uploads/1746351601017-486054461-1745352337710-226738127-v2hg7xy9ty811.jpg',
      isMainMap: true
    }));

    const location = await locationRepo.save(locationRepo.create({
      name: 'Starting Village',
      description: 'The place where all adventures begin.',
      xCoordinate: 55,
      yCoordinate: 35,
      map: 1 
    }));

    // Create skills
    const skills = await skillRepo.save([
      // Pyromancy skills
      skillRepo.create({
        name: 'Fireball',
        description: 'A basic fire attack that deals damage to a single target.',
        branch: 'Pyromancy',
        type: 'Attack',
        basePower: 15,
        duration: 0,
        activation: 'FullAction',
        requiredStats: { STR: 0, DEX: 0, RES: 0, MN: 5, CHA: 0 },
        aetherCost: 10,
        rank: 1,
        isPassive: false
      }),
      // Cryomancy skills
      skillRepo.create({
        name: 'Ice Shield',
        description: 'Creates a protective barrier of ice that reduces incoming damage.',
        branch: 'Cryomancy',
        type: 'Defense',
        basePower: 10,
        duration: 2,
        activation: 'BonusAction',
        requiredStats: { STR: 0, DEX: 0, RES: 5, MN: 0, CHA: 0 },
        aetherCost: 15,
        rank: 1,
        isPassive: false
      }),
      // Chronomancy skills
      skillRepo.create({
        name: 'Time Warp',
        description: 'Temporarily increases the caster\'s speed.',
        branch: 'Chronomancy',
        type: 'Mobility',
        basePower: 20,
        duration: 1,
        activation: 'BonusAction',
        requiredStats: { STR: 0, DEX: 5, RES: 0, MN: 0, CHA: 0 },
        aetherCost: 20,
        rank: 1,
        isPassive: false
      })
    ]);

    // Create a character for the admin user
    const character = await characterRepo.save(characterRepo.create({
      userId: admin.id,
      name: 'Hero',
      surname: 'Adventurer',
      age: 25,
      gender: 'Male',
      raceId: race.id,
      stats: { STR: 10, DEX: 10, RES: 10, MN: 10, CHA: 10 },
      isActive: true,
      background: 'A brave adventurer starting their journey.'
    }));

    // Assign skills to the character
    await characterSkillRepo.save(
      skills.map(skill => characterSkillRepo.create({
        characterId: character.id,
        skillId: skill.id,
        uses: 0,
        rank: 1
      }))
    );

    console.log('Seed data inserted successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();
