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
      length: 100
    },
    description: {
      type: 'text'
    },
    branch: {
      type: 'enum',
      enum: ['Pyromancy', 'Cryomancy', 'Chronomancy']
    },
    type: {
      type: 'enum',
      enum: ['Attack', 'Defense', 'Support', 'Mobility', 'Utility']
    },
    basePower: {
      type: 'float'
    },
    duration: {
      type: 'int'
    },
    activation: {
      type: 'enum',
      enum: ['BonusAction', 'FullAction', 'TwoTurns']
    },
    requiredStats: {
      type: 'json',
      default: {
        STR: 0,
        DEX: 0,
        RES: 0,
        MN: 0,
        CHA: 0
      }
    },
    aetherCost: {
      type: 'int'
    },
    rank: {
      type: 'int',
      default: 1
    },
    parentSkillId: {
      type: 'int',
      nullable: true
    },
    isPassive: {
      type: 'boolean',
      default: false
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
    }
  }
}); 