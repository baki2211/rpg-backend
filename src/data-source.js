import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { User } from './models/userModel.js';
import { Character } from './models/characterModel.js';
import { Race } from './models/raceModel.js';
import { Location } from './models/locationModel.js';
import { Map } from './models/mapModel.js';
import { ChatMessage } from './models/chatMessageModel.js';
import { Skill } from './models/skillModel.js';
import { CharacterSkill } from './models/characterSkillModel.js';
import { CharacterSkillBranch } from './models/characterSkillBranchModel.js';
import { SkillBranch } from './models/skillBranchModel.js';
import { SkillType } from './models/skillTypeModel.js';
import { Session } from './models/sessionModel.js';
import { SessionParticipant } from './models/sessionParticipantModel.js';
import { CombatRound } from './models/combatRoundModel.js';
import { CombatAction } from './models/combatActionModel.js';
import { Event } from './models/eventModel.js';
import { EngineLog } from './models/engineLogModel.js';
import { StatDefinition } from './models/statDefinitionModel.js';
import { CombatConstant } from './models/combatConstantModel.js';
import { MasteryTier } from './models/masteryTierModel.js';
import { SkillValidationRule } from './models/skillValidationRuleModel.js';
import { Rank } from './models/rankModel.js';
import { WikiSection } from './models/wikiSectionModel.js';
import { WikiEntry } from './models/wikiEntryModel.js';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rpg',
  synchronize: process.env.NODE_ENV !== 'production', // Only sync in development
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : false,
  
  // Connection pooling configuration for memory optimization
  poolSize: parseInt(process.env.DB_POOL_SIZE) || 10, // Max connections
  connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000, // 10 seconds
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 10000, // 10 seconds
  timeout: parseInt(process.env.DB_TIMEOUT) || 10000, // 10 seconds
  
  // Additional PostgreSQL-specific pool settings
  extra: {
    // Connection pool settings for node-postgres (pg)
    max: parseInt(process.env.DB_POOL_SIZE) || 10, // Maximum connections
    min: parseInt(process.env.DB_POOL_MIN) || 2,   // Minimum connections
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 seconds
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000, // 10 seconds
    
    // Memory optimization settings
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 seconds
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 seconds
    
    // SSL configuration for production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  
  // Enable connection monitoring
  maxQueryExecutionTime: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD) || 1000, // Log slow queries > 1s
  entities: [
    Character,
    User,
    Race,
    Skill,
    SkillBranch,
    SkillType,
    CharacterSkill,
    CharacterSkillBranch,
    Location,
    Map,
    ChatMessage,
    Session,
    SessionParticipant,
    CombatRound,
    CombatAction,
    Event,
    EngineLog,
    StatDefinition,
    CombatConstant,
    MasteryTier,
    SkillValidationRule,
    Rank,
    WikiSection,
    WikiEntry
  ],
  migrations: ['./src/migrations/*.js'],
  migrationsTableName: 'migrations'
});