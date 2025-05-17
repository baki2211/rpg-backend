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
import { SkillBranch } from './models/skillBranchModel.js';
import { SkillType } from './models/skillTypeModel.js';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rpg',
  synchronize: true, // Auto-sync database schema (set to false in production!)
  logging: true,
  entities: [User, Character, Race, Location, Map, ChatMessage, Skill, CharacterSkill, SkillBranch, SkillType],
  migrations: ['./src/migrations/*.js'],
});