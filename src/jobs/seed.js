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
import { StatDefinition } from '../models/statDefinitionModel.js';

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
    const statDefinitionRepo = AppDataSource.getRepository(StatDefinition);

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

    // Create stat definitions
    const statDefinitionCount = await statDefinitionRepo.count();
    if (statDefinitionCount === 0) {
      const statDefinitions = await statDefinitionRepo.save([
        // Primary Stats (used in character creation and skill scaling)
        statDefinitionRepo.create({
          internalName: 'foc',
          displayName: 'Focus',
          description: 'Mental clarity and precision in channeling Aether. Affects skill success chance, quality of skill outcome, resistance to debuffs.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 1,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'con',
          displayName: 'Control',
          description: 'Finesse and subtle manipulation of Aether\'s form. Affects buff/debuff potency, stealth skills, crafting enhancement.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 2,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'res',
          displayName: 'Resilience',
          description: 'Endurance and toughness of the body enhanced by Aether. Affects max HP, damage resistance, stamina for actions.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 3,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'ins',
          displayName: 'Instinct',
          description: 'Reflexive and subconscious reaction with Aether. Affects turn initiative, reaction speed, dodge/block efficiency.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 4,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'pre',
          displayName: 'Presence',
          description: 'Ability to project personality and intent through Aether. Affects charm, persuasion, deception, threat/intimidation.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 5,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'for',
          displayName: 'Force',
          description: 'Raw power when manifesting Aether externally. Affects offensive skill power, damage scaling, physical feats.',
          category: 'primary_stat',
          defaultValue: 5,
          maxValue: 15,
          minValue: 0,
          sortOrder: 6,
          isActive: true
        }),
        // Resource Stats (derived from primary stats)
        statDefinitionRepo.create({
          internalName: 'hp',
          displayName: 'Health Points',
          description: 'Physical vitality and life force. Derived from Resilience and character level.',
          category: 'resource',
          defaultValue: 100,
          maxValue: null, // No upper limit
          minValue: 0,
          sortOrder: 1,
          isActive: true
        }),
        statDefinitionRepo.create({
          internalName: 'aether',
          displayName: 'Aether',
          description: 'Magical energy used to power skills and abilities. Derived from Focus and character level.',
          category: 'resource',
          defaultValue: 50,
          maxValue: null, // No upper limit
          minValue: 0,
          sortOrder: 2,
          isActive: true
        })
      ]);
      console.log('Stat definitions seeded');
    }

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
      imageUrl: '/uploads/map-placeholder.jpg',
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
        description: 'Channel raw Force through focused Aether to hurl a blazing sphere of fire at your target. The intensity scales with your Force and Focus.',
        branchId: pyromancyBranch.id,
        typeId: attackType.id,
        basePower: 12,
        duration: 0,
        activation: 'BonusAction',
        requiredStats: { foc: 3, con: 0, res: 0, ins: 0, pre: 0, for: 2 },
        scalingStats: ['for', 'foc'],
        aetherCost: 8,
        skillPointCost: 1,
        target: 'other',
        rank: 1,
        isPassive: false,
        unlockConditions: { uses: 0, combinations: [] }
      }),
      skillRepo.create({
        name: 'Ice Shield',
        description: 'Weave Control and Resilience to manifest a protective barrier of crystalline ice around yourself. Duration and strength scale with mastery.',
        branchId: cryomancyBranch.id,
        typeId: defenseType.id,
        basePower: 8,
        duration: 3,
        activation: 'FullAction',
        requiredStats: { foc: 2, con: 3, res: 2, ins: 0, pre: 0, for: 0 },
        scalingStats: ['con', 'res'],
        aetherCost: 12,
        skillPointCost: 2,
        target: 'self',
        rank: 1,
        isPassive: false,
        unlockConditions: { uses: 0, combinations: [] }
      }),
      skillRepo.create({
        name: 'Time Warp',
        description: 'Manipulate the flow of temporal Aether to accelerate allies or slow enemies. Requires precise Focus, commanding Presence, and steady Control.',
        branchId: chronomancyBranch.id,
        typeId: supportType.id,
        basePower: 6,
        duration: 2,
        activation: 'TwoTurns',
        requiredStats: { foc: 4, con: 2, res: 0, ins: 1, pre: 3, for: 0 },
        scalingStats: ['foc', 'pre', 'con'],
        aetherCost: 18,
        skillPointCost: 3,
        target: 'any',
        rank: 1,
        isPassive: false,
        unlockConditions: { uses: 0, combinations: [] }
      }),
      skillRepo.create({
        name: 'Flame Burst',
        description: 'An advanced pyromancy technique that creates an explosive burst of fire around the caster. Requires mastery of basic fire manipulation.',
        branchId: pyromancyBranch.id,
        typeId: attackType.id,
        basePower: 18,
        duration: 0,
        activation: 'FullAction',
        requiredStats: { foc: 5, con: 2, res: 1, ins: 0, pre: 0, for: 4 },
        scalingStats: ['for', 'foc', 'con'],
        aetherCost: 15,
        skillPointCost: 2,
        target: 'other',
        rank: 2,
        isPassive: false,
        unlockConditions: { uses: 10, combinations: ['Fireball'] }
      }),
      skillRepo.create({
        name: 'Frost Armor',
        description: 'A passive enhancement that continuously reinforces the body with protective ice crystals. Provides ongoing damage reduction.',
        branchId: cryomancyBranch.id,
        typeId: defenseType.id,
        basePower: 4,
        duration: 0,
        activation: 'Passive',
        requiredStats: { foc: 3, con: 4, res: 4, ins: 0, pre: 0, for: 0 },
        scalingStats: ['res', 'con'],
        aetherCost: 0,
        skillPointCost: 3,
        target: 'self',
        rank: 2,
        isPassive: true,
        unlockConditions: { uses: 8, combinations: ['Ice Shield'] }
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
      stats: { 
        foc: 10,    // Focus - High for magical aptitude
        con: 8,     // Control - Good precision
        res: 7,     // Resilience - Moderate toughness
        ins: 9,     // Instinct - High reflexes
        pre: 8,     // Presence - Good leadership
        for: 8,     // Force - Good raw power
        hp: 120,    // Health Points - Enhanced for admin
        aether: 80  // Aether - High magical energy
      },
      isActive: true,
      background: 'An administrator with access to powerful abilities and deep understanding of Aether manipulation.',
      experience: 0,
      rank: 1,
      statPoints: 0,
      skillPoints: 10, // Extra skill points for admin
      imageUrl: '/uploads/placeholder.jpg'
    }));

    const userCharacter = await characterRepo.save(characterRepo.create({
      userId: user.id,
      name: 'User',
      surname: 'Character',
      age: 22,
      gender: 'Female',
      raceId: race.id,
      stats: { 
        foc: 8,     // Focus - Good magical potential
        con: 7,     // Control - Developing precision
        res: 9,     // Resilience - High endurance
        ins: 8,     // Instinct - Good reflexes
        pre: 10,    // Presence - Excellent charisma
        for: 6,     // Force - Moderate raw power
        hp: 110,    // Health Points - Good vitality
        aether: 60  // Aether - Standard magical energy
      },
      isActive: true,
      background: 'A promising adventurer with natural charisma and strong resilience, beginning to explore the mysteries of Aether.',
      experience: 0,
      rank: 1,
      statPoints: 0,
      skillPoints: 5, // Starting skill points
      imageUrl: '/uploads/placeholder.jpg'
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
