import { EntitySchema } from 'typeorm';

export const SkillValidationRule = new EntitySchema({
  name: 'SkillValidationRule',
  tableName: 'skill_validation_rules',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    skillType: {
      type: 'varchar',
      length: 50,
      nullable: false  // 'attack', 'defence', 'counter', 'buff_debuff', 'healing'
    },
    skillSubtype: {
      type: 'varchar',
      length: 50,
      nullable: false  // 'light', 'standard', 'heavy', 'perfect', etc.
    },
    minBasePower: {
      type: 'int',
      nullable: false,
      default: 0
    },
    maxBasePower: {
      type: 'int',
      nullable: false,
      default: 100
    },
    minAetherCost: {
      type: 'int',
      nullable: false,
      default: 0
    },
    maxAetherCost: {
      type: 'int',
      nullable: false,
      default: 100
    },
    description: {
      type: 'text',
      nullable: true
    },
    isActive: {
      type: 'boolean',
      nullable: false,
      default: true
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
  indices: [
    {
      name: 'IDX_SKILL_VALIDATION_TYPE',
      columns: ['skillType']
    },
    {
      name: 'IDX_SKILL_VALIDATION_SUBTYPE',
      columns: ['skillSubtype']
    },
    {
      name: 'IDX_SKILL_VALIDATION_ACTIVE',
      columns: ['isActive']
    },
    {
      name: 'IDX_SKILL_VALIDATION_TYPE_SUBTYPE',
      columns: ['skillType', 'skillSubtype'],
      unique: true
    }
  ]
});
