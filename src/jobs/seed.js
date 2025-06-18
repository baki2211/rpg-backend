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
import { WikiSection } from '../models/wikiSectionModel.js';
import { WikiEntry } from '../models/wikiEntryModel.js';

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
    const wikiSectionRepo = AppDataSource.getRepository(WikiSection);
    const wikiEntryRepo = AppDataSource.getRepository(WikiEntry);

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

    // Create wiki sections
    const wikiSectionCount = await wikiSectionRepo.count();
    if (wikiSectionCount === 0) {
      const worldSection = await wikiSectionRepo.save(wikiSectionRepo.create({
        name: 'World Lore',
        slug: 'world-lore',
        description: 'The history, mythology, and fundamental truths of our world.',
        position: 1,
        isActive: true,
        createdBy: admin.id
      }));

      const racesSection = await wikiSectionRepo.save(wikiSectionRepo.create({
        name: 'Races & Peoples',
        slug: 'races-peoples',
        description: 'The various races and cultures that inhabit the world.',
        position: 2,
        isActive: true,
        createdBy: admin.id
      }));

      const magicSection = await wikiSectionRepo.save(wikiSectionRepo.create({
        name: 'Magic & Aether',
        slug: 'magic-aether',
        description: 'Understanding the mystical forces that shape reality.',
        position: 3,
        isActive: true,
        createdBy: admin.id
      }));

      const geographySection = await wikiSectionRepo.save(wikiSectionRepo.create({
        name: 'Geography',
        slug: 'geography',
        description: 'Locations, landmarks, and territories of the known world.',
        position: 4,
        isActive: true,
        createdBy: admin.id
      }));

      // Create wiki entries
      await wikiEntryRepo.save([
        // World Lore entries
        wikiEntryRepo.create({
          sectionId: worldSection.id,
          title: 'The Great Convergence',
          slug: 'great-convergence',
          content: `# The Great Convergence

The Great Convergence marks the defining moment in our world's history when the mystical energy known as **Aether** first merged with the physical realm. This event fundamentally changed the nature of reality itself, imbuing all living beings with the potential to manipulate the very fabric of existence.

## The Time Before

Before the Convergence, the world was governed by purely physical laws. Magic existed only in distant realms, separated from our reality by impenetrable barriers. Civilizations rose and fell based on technological advancement, political cunning, and military might alone.

## The Event

Approximately 1,000 years ago, reality experienced what scholars call "The Thinning" - a gradual weakening of the barriers between dimensions. This culminated in the Great Convergence, when Aether first flooded into our world.

The initial contact was catastrophic. Entire kingdoms vanished overnight, while others found themselves transformed beyond recognition. The survivors were those who could adapt to this new reality - learning to harmonize with Aether rather than resist it.

## Aftermath and Transformation

The Convergence reshaped everything:

- **Physical Laws**: Matter could now be altered through focused will and Aether manipulation
- **Biology**: All living creatures gained the ability to channel Aether, though to varying degrees
- **Society**: New hierarchies emerged based on Aether mastery rather than birthright or wealth
- **Technology**: Ancient devices powered by steam and clockwork gave way to Aether-infused artifacts`,
          excerpt: 'The defining moment when Aether merged with our reality, forever changing the world.',
          tags: ['history', 'aether', 'convergence', 'ancient'],
          isPublished: true,
          position: 1,
          viewCount: 0,
          createdBy: admin.id
        }),

        wikiEntryRepo.create({
          sectionId: worldSection.id,
          title: 'The Age of Exploration',
          slug: 'age-of-exploration',
          content: `# The Age of Exploration

Following the Great Convergence, survivors found themselves in a world both familiar and utterly foreign. The Age of Exploration began as scattered communities ventured forth to rediscover their transformed world.

## Rediscovering the World

The Convergence had not only changed the laws of physics but also the geography itself. Mountains floated in mid-air, sustained by Aether currents. Forests grew in impossible spirals, their trees reaching between dimensions. Seas became navigable through both water and air, as skilled navigators learned to sail on currents of pure energy.

## The First Explorers

Brave souls who first mastered basic Aether manipulation became the pathfinders of this new era. They mapped the shifted continents, catalogued the new flora and fauna, and established contact between isolated survivor settlements.

These early explorers developed the first systematic approaches to Aether mastery, creating the foundation for what would become modern skill branches like Pyromancy, Cryomancy, and Chronomancy.

## Establishing Trade Routes

As communities reconnected, new forms of commerce emerged. Traditional goods remained valuable, but Aether-infused materials became the cornerstone of the new economy. Routes were established not just across land and sea, but through dimensional rifts that experienced navigators could access.`,
          excerpt: 'How survivors rebuilt civilization after the Convergence, exploring and mapping the transformed world.',
          tags: ['history', 'exploration', 'post-convergence', 'civilization'],
          isPublished: true,
          position: 2,
          viewCount: 0,
          createdBy: admin.id
        }),

        // Races & Peoples entries
        wikiEntryRepo.create({
          sectionId: racesSection.id,
          title: 'Humans',
          slug: 'humans',
          content: `# Humans

Humans represent the most adaptable and diverse of all races in the post-Convergence world. While they lack the specialized bonuses of other races, their versatility and natural balance make them capable of mastering any aspect of Aether manipulation.

## Physical Characteristics

Post-Convergence humans retain most of their pre-Convergence appearance, though subtle changes have occurred over the generations. Many humans now display faint luminescent patterns in their eyes when channeling Aether, and their lifespans have increased by approximately 20-30 years.

## Aether Affinity

Humans show remarkable balance across all six primary stats:
- **Focus**: Natural mental clarity allows for precise Aether channeling
- **Control**: Inherent dexterity translates well to subtle energy manipulation  
- **Resilience**: Adaptability helps resist both physical and magical stresses
- **Instinct**: Survival instincts enhanced by Aether sensitivity
- **Presence**: Social nature amplified by energy projection abilities
- **Force**: Moderate but reliable capacity for raw power expression

## Cultural Diversity

Human settlements vary dramatically in their approach to Aether mastery:

### The Academy Cities
Centers of learning where systematic study of Aether has produced the most advanced magical techniques.

### Nomadic Tribes
Groups that have embraced a more intuitive, nature-connected approach to energy manipulation.

### Merchant Republics
Communities focused on the practical applications of Aether for trade and industry.`,
          excerpt: 'The most adaptable race, capable of balanced mastery across all Aether disciplines.',
          tags: ['races', 'humans', 'aether', 'adaptable'],
          isPublished: true,
          position: 1,
          viewCount: 0,
          createdBy: admin.id
        }),

        // Magic & Aether entries
        wikiEntryRepo.create({
          sectionId: magicSection.id,
          title: 'Understanding Aether',
          slug: 'understanding-aether',
          content: `# Understanding Aether

Aether is the fundamental force that permeates all existence since the Great Convergence. It is both energy and information, matter and spirit, existing simultaneously in multiple states until directed by conscious will.

## The Nature of Aether

Aether defies traditional categorization. Scholars describe it as:

- **Responsive**: It reacts to conscious intention and emotional state
- **Persistent**: Once shaped, it maintains form until actively altered
- **Interconnected**: All Aether is part of a vast, universal network
- **Transformative**: It can become any form of energy or matter needed

## The Six Aspects

Aether manipulation is understood through six primary aspects, each corresponding to fundamental approaches to energy work:

### Focus (Mental Clarity)
The ability to direct attention and intent with precision. High Focus allows for:
- More accurate targeting of abilities
- Resistance to mental interference
- Enhanced learning of new techniques

### Control (Subtle Manipulation)
Finesse in shaping Aether's form and function. High Control enables:
- More efficient energy usage
- Complex multi-layered effects
- Precise timing of ability activation

### Resilience (Endurance & Resistance)
The capacity to withstand and work with powerful energies. High Resilience provides:
- Greater tolerance for energy strain
- Natural armor against hostile effects
- Faster recovery from exertion

### Instinct (Reflexive Response)
Unconscious attunement to Aether flows and dangers. High Instinct grants:
- Faster reaction times in combat
- Intuitive understanding of energy patterns
- Early warning of approaching threats

### Presence (Projected Will)
The ability to extend one's influence through Aether. High Presence allows:
- More effective social manipulation
- Stronger leadership abilities
- Enhanced intimidation or inspiration

### Force (Raw Power)
The capacity for dramatic, high-energy manifestations. High Force enables:
- More devastating offensive abilities
- Overwhelming defensive barriers
- Impressive displays of power`,
          excerpt: 'A comprehensive guide to the mystical energy that shapes reality.',
          tags: ['aether', 'magic', 'theory', 'fundamentals'],
          isPublished: true,
          position: 1,
          viewCount: 0,
          createdBy: admin.id
        }),

        wikiEntryRepo.create({
          sectionId: magicSection.id,
          title: 'Pyromancy - The Art of Fire',
          slug: 'pyromancy',
          content: `# Pyromancy - The Art of Fire

Pyromancy represents one of the most visually dramatic and immediately powerful branches of Aether manipulation. By channeling raw Force through focused intention, practitioners can manifest and control flames that burn hotter and longer than any natural fire.

## Fundamental Principles

Pyromancy operates on three core principles:

### Ignition
The initial manifestation of Aether as thermal energy. This requires significant Force to overcome the natural state of matter, but only minimal Focus to maintain once established.

### Intensity
The control of flame temperature and energy output. Higher Force creates more intense fires, while Control determines precision and efficiency.

### Direction
The ability to guide and shape flame without losing control. This primarily relies on Control and Focus working in harmony.

## Basic Techniques

### Fireball
The foundational pyromancy technique, creating a sphere of concentrated flame that can be hurled at targets. Requires:
- **Force**: 2+ for basic manifestation
- **Focus**: 3+ for accurate targeting
- **Aether Cost**: 8 per cast

### Flame Burst
An advanced technique creating an explosive area effect. The practitioner becomes the center of an expanding ring of fire. Requires:
- **Force**: 4+ for sufficient power
- **Focus**: 5+ for maintaining control during explosion
- **Control**: 2+ for avoiding self-harm
- **Aether Cost**: 15 per cast

## Advanced Applications

Master pyromancers can achieve effects impossible through conventional means:
- Flames that burn underwater or in vacuum
- Fire that freezes rather than burns
- Emotional resonance flames that respond to the target's feelings
- Persistent fires that burn for days without fuel`,
          excerpt: 'The dangerous art of manifesting and controlling supernatural flames.',
          tags: ['magic', 'pyromancy', 'fire', 'combat', 'techniques'],
          isPublished: true,
          position: 2,
          viewCount: 0,
          createdBy: admin.id
        }),

        // Geography entries
        wikiEntryRepo.create({
          sectionId: geographySection.id,
          title: 'The Starting Village',
          slug: 'starting-village',
          content: `# The Starting Village

Nestled in a protected valley where Aether currents flow gently and predictably, the Starting Village serves as a sanctuary for those beginning their journey into the transformed world. This peaceful settlement has become the traditional launching point for new adventurers.

## Location and Geography

The village sits at coordinates (55, 35) on the main continental map, positioned at the confluence of three minor Aether streams. This natural arrangement creates a stable magical environment ideal for learning and growth.

### The Valley
- **Protected**: High ridges on three sides shield from harsh weather and dangerous Aether storms
- **Fertile**: The soil has been enriched by centuries of gentle Aether infusion
- **Accessible**: Multiple paths lead out of the valley toward different regions

## Notable Features

### The Training Grounds
An open area where newcomers can safely practice basic Aether manipulation without risk to themselves or others. The ground here has been specially treated to absorb excess energy.

### The Welcome Hall
The village's central building, where new arrivals receive orientation about the transformed world and basic instruction in Aether safety.

### The Mentor Circle
A ring of simple stone monuments where experienced practitioners offer guidance to beginners. Each stone is inscribed with fundamental principles of Aether mastery.

### The Safe House
Emergency shelter with Aether-dampening properties, providing refuge if someone loses control during practice.

## The Community

The village is home to approximately 200 residents, most of whom are either:
- **Mentors**: Experienced practitioners who have chosen to help newcomers
- **Artisans**: Crafters who create basic equipment and supplies for adventurers
- **Scholars**: Researchers documenting the ongoing changes to the world
- **Newcomers**: Recent arrivals learning the fundamentals before venturing forth

## Departure Traditions

When someone feels ready to leave the Starting Village, they participate in the "First Step" ceremony. This involves demonstrating basic competency in at least one Aether technique and receiving a blessing from the village elders.

Most departing adventurers choose one of three traditional paths:
- **The Scholar's Road**: Leading to the Academy Cities
- **The Merchant Trail**: Connecting to major trade routes
- **The Wild Path**: Into unexplored territories`,
          excerpt: 'A peaceful sanctuary where new adventurers begin their journey into the Aether-transformed world.',
          tags: ['geography', 'village', 'starting-area', 'safe', 'training'],
          isPublished: true,
          position: 1,
          viewCount: 0,
          createdBy: admin.id
        })
      ]);

      console.log('Wiki content seeded successfully');
    }

    console.log('Seed data inserted successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();
