import { EntitySchema } from 'typeorm';
import { Character } from './characterModel.js';

export const Skill = new EntitySchema({
  name: 'Skill',
  tableName: 'skills',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    name: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    description: {
      type: 'text',
      nullable: true
    },
    branchId: {
      type: 'int',
      nullable: false
    },
    typeId: {
      type: 'int',
      nullable: false
    },
    basePower: {
      type: 'int',
      nullable: false
    },
    duration: {
      type: 'int',
      nullable: false
    },
    activation: {
      type: 'varchar',
      length: 255,
      nullable: false
    },
    requiredStats: {
      type: 'jsonb',
      nullable: true
    },
    // Valid scaling stats: FOC (Focus), CON (Control), RES (Resilience), INS (Instinct), PRE (Presence), FOR (Force)
    scalingStats: {
      type: 'jsonb',
      nullable: true,
      default: []  // Array of up to 3 scaling stats
    },
    aetherCost: {
      type: 'int',
      nullable: false
    },
    skillPointCost: {
      type: 'int',
      nullable: false,
      default: 1  // Default cost for skills
    },
    target: {
      type: 'varchar',
      length: 10,
      nullable: false,
      default: 'other'  // Values: 'self', 'other', 'none'
    },
    rank: {
      type: 'int',
      nullable: false
    },
    parentSkillId: {
      type: 'int',
      nullable: true
    },
    isPassive: {
      type: 'boolean',
      nullable: false
    },
    unlockConditions: {
      type: 'jsonb',
      default: {
        uses: 0,
        combinations: []
      }
    },
    mutationOptions: {
      type: 'jsonb',
      nullable: true
    },
    comboTag: {
      type: 'varchar',
      length: 50,
      nullable: true
    },
    createdAt: {
      type: 'timestamp',
      createDate: true
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true
    }
  },
  relations: {
    parentSkill: {
      target: 'Skill',
      type: 'many-to-one',
      joinColumn: { name: 'parentSkillId' },
      nullable: true
    },
    childSkills: {
      target: 'Skill',
      type: 'one-to-many',
      inverseSide: 'parentSkill'
    },
    characters: {
      target: 'Character',
      type: 'many-to-many',
      joinTable: {
        name: 'character_skills',
        joinColumn: { name: 'skillId' },
        inverseJoinColumn: { name: 'characterId' }
      }
    },
    branch: {
      type: 'many-to-one',
      target: 'SkillBranch',
      joinColumn: {
        name: 'branchId'
      }
    },
    type: {
      type: 'many-to-one',
      target: 'SkillType',
      joinColumn: {
        name: 'typeId'
      }
    }
  }
}); 