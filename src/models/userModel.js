import { EntitySchema } from 'typeorm';
  
export const User = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    username: {
      type: 'varchar',
      length: 50,
      unique: true,
    },
    password: {
      type: 'varchar',
      length: 255,
    },
    role: {
      type: 'varchar',
      length: 20,
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
    characters: {
      target: 'characters',
      type: 'one-to-many',
      inverseSide: 'user',
    },
  },
});