import { EntitySchema } from 'typeorm';
import { Race } from './raceModel.js';
import { User } from './userModel.js';
import { Skill } from './skillModel.js';

export const Character = new EntitySchema({
  name: 'Character',
  tableName: 'characters',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    userId: {
      type: 'int',
      nullable: true, // Allow null for NPCs
    },
    name: {
      type: 'varchar',
      length: 50,
    },
    surname: {
      type: 'varchar',
      length: 50,
    },
    imageUrl: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    age: {
      type: 'int',
    },
    gender: {
      type: 'varchar',
      length: 20,
    },
    raceId: {
      type: 'int',
    },
    stats: {
      type: 'jsonb',
      default: {},
    },
    isActive: {
      type: 'boolean',
      default: false,
    },
    background: {
      type: 'text',
      nullable: true,
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true,
    },
    experience: {
      type: 'float',
      nullable: false,
      default: 0
    },
    skillPoints: {
      type: 'int',
      nullable: false,
      default: 5  // Starting skill points for new characters
    },
    rank: {
      type: 'int',
      nullable: false,
      default: 1
    },
    statPoints: {
      type: 'int',
      nullable: false,
      default: 0
    },
    isNPC: {
      type: 'boolean',
      nullable: false,
      default: false
    },
    createdBy: {
      type: 'int',
      nullable: true, // User ID of admin/master who created the NPC
    }
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      inverseSide: 'characters',
      joinColumn: { name: 'userId' },
      onDelete: 'CASCADE',
      nullable: true, // Allow null for NPCs
    },
    race: {
      target: 'Race',
      type: 'many-to-one',
      joinColumn: { name: 'raceId' },
      inverseSide: 'characters',
      onDelete: 'CASCADE',
    },
    skills: {
      target: 'Skill',
      type: 'many-to-many',
      joinTable: {
        name: 'character_skills',
        joinColumn: { name: 'characterId' },
        inverseJoinColumn: { name: 'skillId' }
      }
    },
    creator: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'createdBy' },
      nullable: true,
    }
  },
});