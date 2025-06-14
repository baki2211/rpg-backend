import { EntitySchema } from 'typeorm';

export const EngineLog = new EntitySchema({
  name: 'EngineLog',
  tableName: 'engine_logs',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    sessionId: {
      type: 'int',
      nullable: false  // Link to the session where this log occurred
    },
    locationId: {
      type: 'int',
      nullable: false  // Location where the action took place
    },
    type: {
      type: 'varchar',
      length: 20,
      nullable: false  // 'skill_use', 'clash', 'damage', 'effect'
    },
    actor: {
      type: 'varchar',
      length: 100,
      nullable: false  // Character name who performed the action
    },
    target: {
      type: 'varchar',
      length: 100,
      nullable: true   // Target character name (if applicable)
    },
    skill: {
      type: 'varchar',
      length: 100,
      nullable: true   // Skill name used
    },
    damage: {
      type: 'int',
      nullable: true   // Damage dealt (if applicable)
    },
    effects: {
      type: 'jsonb',
      nullable: true   // Array of effects
    },
    details: {
      type: 'text',
      nullable: false  // Detailed description of what happened
    },
    engineData: {
      type: 'jsonb',
      nullable: true   // Additional engine calculation data
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    }
  },
  relations: {
    session: {
      type: 'many-to-one',
      target: 'Session',
      joinColumn: { name: 'sessionId' },
      onDelete: 'CASCADE'
    }
  },
  indices: [
    {
      name: 'IDX_ENGINE_LOG_SESSION',
      columns: ['sessionId']
    },
    {
      name: 'IDX_ENGINE_LOG_LOCATION',
      columns: ['locationId']
    },
    {
      name: 'IDX_ENGINE_LOG_TYPE',
      columns: ['type']
    }
  ]
}); 