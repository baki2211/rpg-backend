import { EntitySchema } from 'typeorm';

export const CombatAction = new EntitySchema({
  name: 'CombatAction',
  tableName: 'combat_actions',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    roundId: {
      type: 'int',
      nullable: false
    },
    characterId: {
      type: 'int',
      nullable: false
    },
    skillId: {
      type: 'int',
      nullable: false
    },
    targetId: {
      type: 'int',
      nullable: true  // null for self-targeting or area skills
    },
    finalOutput: {
      type: 'int',
      nullable: false  // Result from SkillEngine.computeFinalOutput()
    },
    outcomeMultiplier: {
      type: 'decimal',
      precision: 3,
      scale: 2,
      nullable: false  // The roll outcome (0.6, 1.0, 1.4)
    },
    rollQuality: {
      type: 'varchar',
      length: 20,
      nullable: false  // Poor, Standard, Critical
    },
    skillData: {
      type: 'json',
      nullable: false  // Store skill name, type, branch info
    },
    characterData: {
      type: 'json',
      nullable: false  // Store character name and relevant stats
    },
    targetData: {
      type: 'json',
      nullable: true   // Store target character info if applicable
    },
    submittedAt: {
      type: 'timestamp',
      createDate: true,
    },
    processed: {
      type: 'boolean',
      default: false   // Whether this action has been processed in resolution
    },
    clashResult: {
      type: 'json',
      nullable: true   // Store clash result if this action was part of a clash
    }
  },
  relations: {
    round: {
      type: 'many-to-one',
      target: 'CombatRound',
      joinColumn: { name: 'roundId' },
      onDelete: 'CASCADE'
    },
    character: {
      type: 'many-to-one',
      target: 'Character',
      joinColumn: { name: 'characterId' }
    },
    skill: {
      type: 'many-to-one',
      target: 'Skill',
      joinColumn: { name: 'skillId' }
    },
    target: {
      type: 'many-to-one',
      target: 'Character',
      joinColumn: { name: 'targetId' },
      nullable: true
    }
  },
  indices: [
    {
      name: 'IDX_COMBAT_ACTION_ROUND',
      columns: ['roundId']
    },
    {
      name: 'IDX_COMBAT_ACTION_CHARACTER',
      columns: ['characterId']
    },
    {
      name: 'IDX_COMBAT_ACTION_UNIQUE_PER_ROUND',
      columns: ['roundId', 'characterId'],
      unique: true  // One action per character per round
    }
  ]
}); 