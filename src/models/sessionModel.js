import { EntitySchema } from 'typeorm';

export const Session = new EntitySchema({
  name: 'Session',
  tableName: 'sessions',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      length: 100,
    },
    locationId: {
      type: 'int',
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true,
    },
     isActive: {
      type: 'boolean',
      default: true
    },
    status: {
      type: 'varchar',
      length: 20,
      default: 'open'  // open, closed, frozen
    },
    expirationTime: {
      type: 'timestamp',
      nullable: true
    }
  },
  relations: {
    participants: {
      type: 'one-to-many',
      target: 'SessionParticipant',
      inverseSide: 'session'
    },
    messages: {
      type: 'one-to-many',
      target: 'ChatMessage',
      inverseSide: 'session'
    }
  }
});