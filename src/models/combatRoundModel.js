import { EntitySchema } from 'typeorm';

export const CombatRound = new EntitySchema({
  name: 'CombatRound',
  tableName: 'combat_rounds',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    roundNumber: {
      type: 'int',
      nullable: false
    },
    locationId: {
      type: 'int',
      nullable: false
    },
    sessionId: {
      type: 'int',
      nullable: true
    },
    eventId: {
      type: 'int',
      nullable: true  // Combat rounds can be part of an event
    },
    status: {
      type: 'varchar',
      length: 20,
      default: 'active',  // active, resolved, cancelled
      nullable: false
    },
    createdBy: {
      type: 'int',
      nullable: false  // Master/admin who created the round
    },
    resolvedBy: {
      type: 'int',
      nullable: true   // Master/admin who resolved the round
    },
    resolutionData: {
      type: 'jsonb',
      nullable: true   // Store resolution results
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    resolvedAt: {
      type: 'timestamp',
      nullable: true
    },
  },
  relations: {
    actions: {
      type: 'one-to-many',
      target: 'CombatAction',
      inverseSide: 'round'
    },
    session: {
      type: 'many-to-one',
      target: 'Session',
      joinColumn: { name: 'sessionId' },
      nullable: true
    },
    event: {
      type: 'many-to-one',
      target: 'Event',
      joinColumn: { name: 'eventId' },
      nullable: true
    }
  },
  indices: [
    {
      name: 'IDX_COMBAT_ROUND_LOCATION',
      columns: ['locationId']
    },
    {
      name: 'IDX_COMBAT_ROUND_SESSION',
      columns: ['sessionId']
    },
    {
      name: 'IDX_COMBAT_ROUND_EVENT',
      columns: ['eventId']
    }
  ]
}); 