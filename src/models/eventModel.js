import { EntitySchema } from 'typeorm';

export const Event = new EntitySchema({
  name: 'Event',
  tableName: 'events',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    title: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    type: {
      type: 'varchar',
      length: 20,
      nullable: false  // lore, duel, quest
    },
    description: {
      type: 'text',
      nullable: true
    },
    locationId: {
      type: 'int',
      nullable: false
    },
    sessionId: {
      type: 'int',
      nullable: true
    },
    status: {
      type: 'varchar',
      length: 20,
      default: 'active',  // active, closed
      nullable: false
    },
    createdBy: {
      type: 'int',
      nullable: false  // Master/admin who created the event
    },
    closedBy: {
      type: 'int',
      nullable: true   // Master/admin who closed the event
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    closedAt: {
      type: 'timestamp',
      nullable: true
    },
    eventData: {
      type: 'jsonb',
      nullable: true   // Store additional event metadata
    }
  },
  relations: {
    rounds: {
      type: 'one-to-many',
      target: 'CombatRound',
      inverseSide: 'event'
    },
    session: {
      type: 'many-to-one',
      target: 'Session',
      joinColumn: { name: 'sessionId' },
      nullable: true
    }
  },
  indices: [
    {
      name: 'IDX_EVENT_LOCATION',
      columns: ['locationId']
    },
    {
      name: 'IDX_EVENT_SESSION',
      columns: ['sessionId']
    },
    {
      name: 'IDX_EVENT_STATUS',
      columns: ['status']
    }
  ]
}); 