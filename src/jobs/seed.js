import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source.js';
import { User } from '../models/userModel.js';
import { Race } from '../models/raceModel.js';
import { Map } from '../models/mapModel.js';
import { Location } from '../models/locationModel.js';
import { Skill } from '../models/skillModel.js';
import { Character } from '../models/characterModel.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { SkillBranch } from '../models/skillBranchModel.js';
import { SkillType } from '../models/skillTypeModel.js';

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
    const skillBranchRepo = AppDataSource.getRepository(SkillBranch);
    const skillTypeRepo = AppDataSource.getRepository(SkillType);

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
      description: 'A versatile race with balanced stats.',
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
      name: 'Main Map',
      description: 'The main map of the game.',
      imageUrl: '/uploads/1746351601017-486054461-1745352337710-226738127-v2hg7xy9ty811.jpg',
      isMainMap: true
    }));

    const location = await locationRepo.save(locationRepo.create({
      name: 'Starting Village',
      description: 'A peaceful village where adventurers begin their journey.',
      xCoordinate: 55,
      yCoordinate: 35,
      map: map
    }));

    // Create skill branches
    const pyromancyBranch = await skillBranchRepo.save(skillBranchRepo.create({
      name: 'Pyromancy',
      description: 'The art of fire magic.'
    }));
    const cryomancyBranch = await skillBranchRepo.save(skillBranchRepo.create({
      name: 'Cryomancy',
      description: 'The art of ice magic.'
    }));
    const chronomancyBranch = await skillBranchRepo.save(skillBranchRepo.create({
      name: 'Chronomancy',
      description: 'The art of time magic.'
    }));

    // Create skill types
    const attackType = await skillTypeRepo.save(skillTypeRepo.create({
      name: 'Attack',
      description: 'Skills that deal damage.'
    }));
    const defenseType = await skillTypeRepo.save(skillTypeRepo.create({
      name: 'Defense',
      description: 'Skills that provide protection.'
    }));
    const supportType = await skillTypeRepo.save(skillTypeRepo.create({
      name: 'Support',
      description: 'Skills that aid allies.'
    }));

    // Create skills
    const skills = await skillRepo.save([
      skillRepo.create({
        name: 'Fireball',
        description: 'A basic fire attack.',
        branch: pyromancyBranch,
        type: attackType,
        basePower: 10,
        duration: 0,
        activation: 'BonusAction',
        requiredStats: { STR: 0, DEX: 0, RES: 0, MN: 0, CHA: 0 },
        aetherCost: 5,
        rank: 1,
        isPassive: false
      }),
      skillRepo.create({
        name: 'Ice Shield',
        description: 'A defensive ice barrier.',
        branch: cryomancyBranch,
        type: defenseType,
        basePower: 5,
        duration: 3,
        activation: 'FullAction',
        requiredStats: { STR: 0, DEX: 0, RES: 0, MN: 0, CHA: 0 },
        aetherCost: 8,
        rank: 1,
        isPassive: false
      }),
      skillRepo.create({
        name: 'Time Warp',
        description: 'A support skill that manipulates time.',
        branch: chronomancyBranch,
        type: supportType,
        basePower: 0,
        duration: 2,
        activation: 'TwoTurns',
        requiredStats: { STR: 0, DEX: 0, RES: 0, MN: 0, CHA: 0 },
        aetherCost: 12,
        rank: 1,
        isPassive: false
      })
    ]);

    // Create a character for the admin user
    const character = await characterRepo.save(characterRepo.create({
      userId: admin.id,
      name: 'Admin Character',
      surname: 'Adventurer',
      age: 25,
      gender: 'Male',
      raceId: race.id,
      stats: { STR: 10, DEX: 10, RES: 10, MN: 10, CHA: 10 },
      isActive: true,
      background: 'A brave adventurer starting their journey.',
      location: location,
      experience: 0
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
