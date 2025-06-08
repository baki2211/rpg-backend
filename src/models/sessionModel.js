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
    isEvent: {
      type: 'boolean',
      default: false  // true for event sessions, false for free roleplay
    },
    eventId: {
      type: 'int',
      nullable: true  // Link to the event if this is an event session
    },
    status: {
      type: 'varchar',
      length: 20,
      default: 'open'  // open, closed, frozen
    },
    expirationTime: {
      type: 'timestamp',
      nullable: true
    },
    frozenState: {
      type: 'text',
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
    },
    event: {
      type: 'one-to-one',
      target: 'Event',
      joinColumn: { name: 'eventId' },
      nullable: true
    }
  }
});