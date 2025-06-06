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
      type: 'json',
      nullable: true
    },
    scalingStat: {
      type: 'varchar',
      length: 255,
      nullable: true
    },
    scalingFactor: {
      type: 'float',
      nullable: true
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
      type: 'json',
      default: {
        uses: 0,
        combinations: []
      }
    },
    mutationOptions: {
      type: 'json',
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