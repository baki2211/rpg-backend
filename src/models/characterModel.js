import { EntitySchema } from 'typeorm';
import { Race } from './raceModel.js';
import { User } from './userModel.js';

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
    },
    name: {
      type: 'varchar',
      length: 50,
    },
    surname: {
      type: 'varchar',
      length: 50,
    },
    // imageUrl: {
    //   type: 'varchar',
    //   length: 255,
    //   nullable: true,
    // },
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
      type: 'json',
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
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      inverseSide: 'characters',
      joinColumn: { name: 'userId' },
      onDelete: 'CASCADE',
    },
    race: {
      target: 'Race',
      type: 'many-to-one',
      joinColumn: { name: 'raceId' },
      inverseSide: 'characters',
      onDelete: 'CASCADE',
    },
  },
});