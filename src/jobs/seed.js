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
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';
import { SkillBranch } from '../models/skillBranchModel.js';
import { SkillType } from '../models/skillTypeModel.js';
import { Session } from '../models/sessionModel.js';
import { SessionParticipant } from '../models/sessionParticipantModel.js';
import { ChatMessage } from '../models/chatMessageModel.js';
import { Rank } from '../models/rankModel.js';

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
    const characterSkillBranchRepo = AppDataSource.getRepository(CharacterSkillBranch);
    const skillBranchRepo = AppDataSource.getRepository(SkillBranch);
    const skillTypeRepo = AppDataSource.getRepository(SkillType);
    const sessionRepo = AppDataSource.getRepository(Session);
    const sessionParticipantRepo = AppDataSource.getRepository(SessionParticipant);
    const chatMessageRepo = AppDataSource.getRepository(ChatMessage);
    const rankRepo = AppDataSource.getRepository(Rank);

    const userCount = await userRepo.count();
    if (userCount > 0) {
      console.log('Seed data already exists. Skipping...');
      return;
    }

    // Create users with specified credentials
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    const userPasswordHash = await bcrypt.hash('user', 10);

    const [admin, user] = await userRepo.save([
      userRepo.create({ username: 'admin', password: adminPasswordHash, role: 'admin' }),
      userRepo.create({ username: 'user', password: userPasswordHash, role: 'user' })
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

    // Create skills with updated structure
    const skills = await skillRepo.save([
      skillRepo.create({
        name: 'Fireball',
        description: 'A basic fire attack that hurls a ball of flame at the target.',
        branchId: pyromancyBranch.id,
        typeId: attackType.id,
        basePower: 10,
        duration: 0,
        activation: 'BonusAction',
        requiredStats: { FOC: 0, CON: 0, RES: 0, INS: 0, PRE: 0, FOR: 0 },
        scalingStats: ['FOR', 'FOC'],
        aetherCost: 5,
        skillPointCost: 1,
        target: 'other',
        rank: 1,
        isPassive: false
      }),
      skillRepo.create({
        name: 'Ice Shield',
        description: 'A defensive ice barrier that protects the caster.',
        branchId: cryomancyBranch.id,
        typeId: defenseType.id,
        basePower: 5,
        duration: 3,
        activation: 'FullAction',
        requiredStats: { FOC: 0, CON: 0, RES: 0, INS: 0, PRE: 0, FOR: 0 },
        scalingStats: ['CON', 'RES'],
        aetherCost: 8,
        skillPointCost: 2,
        target: 'self',
        rank: 1,
        isPassive: false
      }),
      skillRepo.create({
        name: 'Time Warp',
        description: 'A support skill that manipulates the flow of time around allies.',
        branchId: chronomancyBranch.id,
        typeId: supportType.id,
        basePower: 0,
        duration: 2,
        activation: 'TwoTurns',
        requiredStats: { FOC: 0, CON: 0, RES: 0, INS: 0, PRE: 0, FOR: 0 },
        scalingStats: ['FOC', 'PRE', 'CON'],
        aetherCost: 12,
        skillPointCost: 3,
        target: 'none',
        rank: 1,
        isPassive: false
      })
    ]);

    // Seed rank progression if not present
    const rankCount = await rankRepo.count();
    if (rankCount === 0) {
      const rankSeedData = [
        { level:1, requiredExperience:0,    statPoints:0,  skillPoints:0, aetherPercent:0,  hpPercent:0 },
        { level:2, requiredExperience:500,  statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:3, requiredExperience:750,  statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:4, requiredExperience:1200, statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:5, requiredExperience:1800, statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:6, requiredExperience:2700, statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:7, requiredExperience:4000, statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 },
        { level:8, requiredExperience:6000, statPoints:16, skillPoints:2, aetherPercent:3,  hpPercent:4 }
      ];
      await rankRepo.save(rankSeedData.map(r=>rankRepo.create(r)));
      console.log('Ranks seeded');
    }

    // Create characters for both users
    const adminCharacter = await characterRepo.save(characterRepo.create({
      userId: admin.id,
      name: 'Admin',
      surname: 'Character',
      age: 25,
      gender: 'Non-binary',
      raceId: race.id,
      stats: { foc: 10, con: 8, res: 7, ins: 9, pre: 8, for: 8, hp:100, aether:50 },
      isActive: true,
      background: 'An administrator with access to powerful abilities.',
      experience: 0,
      rank:1,
      statPoints:0,
      skillPoints: 10 // Extra skill points for admin
    }));

    const userCharacter = await characterRepo.save(characterRepo.create({
      userId: user.id,
      name: 'User',
      surname: 'Character',
      age: 22,
      gender: 'Female',
      raceId: race.id,
      stats: { foc: 8, con: 7, res: 9, ins: 8, pre: 10, for: 8, hp:100, aether:50 },
      isActive: true,
      background: 'A regular user exploring the world.',
      experience: 0,
      rank:1,
      statPoints:0,
      skillPoints: 5 // Starting skill points
    }));

    // Assign skills to admin character
    await characterSkillRepo.save(
      skills.map(skill => characterSkillRepo.create({
        characterId: adminCharacter.id,
        skillId: skill.id,
        uses: 0,
        rank: 1
      }))
    );

    // Assign basic skill to user character
    await characterSkillRepo.save([
      characterSkillRepo.create({
        characterId: userCharacter.id,
        skillId: skills[0].id, // Fireball skill
        uses: 0,
        rank: 1
      })
    ]);

    // Create initial skill branch usage records
    await characterSkillBranchRepo.save([
      characterSkillBranchRepo.create({
        characterId: adminCharacter.id,
        branchId: pyromancyBranch.id,
        uses: 0,
        rank: 1
      }),
      characterSkillBranchRepo.create({
        characterId: adminCharacter.id,
        branchId: cryomancyBranch.id,
        uses: 0,
        rank: 1
      }),
      characterSkillBranchRepo.create({
        characterId: adminCharacter.id,
        branchId: chronomancyBranch.id,
        uses: 0,
        rank: 1
      }),
      characterSkillBranchRepo.create({
        characterId: userCharacter.id,
        branchId: pyromancyBranch.id,
        uses: 0,
        rank: 1
      })
    ]);

    // Create a session for the starting location
    const session = await sessionRepo.save(sessionRepo.create({
      name: 'Starting Village Session',
      locationId: location.id,
      isActive: true,
      expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    }));

    // Add both characters as participants
    await sessionParticipantRepo.save([
      sessionParticipantRepo.create({
        sessionId: session.id,
        characterId: adminCharacter.id
      }),
      sessionParticipantRepo.create({
        sessionId: session.id,
        characterId: userCharacter.id
      })
    ]);

    // Create a welcome message
    await chatMessageRepo.save(chatMessageRepo.create({
      location: { id: location.id },
      userId: admin.id,
      characterId: adminCharacter.id,
      message: 'Welcome to the RPG world! This is the starting village where your adventure begins.',
      senderName: 'Admin Character',
      username: 'Admin Character',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    console.log('Seed data inserted successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();
