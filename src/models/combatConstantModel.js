import { EntitySchema } from 'typeorm';

export const CombatConstant = new EntitySchema({
  name: 'CombatConstant',
  tableName: 'combat_constants',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    constantKey: {
      type: 'varchar',
      length: 100,
      nullable: false,
      unique: true  // e.g., 'HP_SCALE', 'DAMAGE_REDUCTION_RATE'
    },
    displayName: {
      type: 'varchar',
      length: 200,
      nullable: false  // e.g., 'HP Scaling Factor', 'Damage Reduction Rate'
    },
    description: {
      type: 'text',
      nullable: true
    },
    value: {
      type: 'decimal',
      precision: 10,
      scale: 4,
      nullable: false
    },
    category: {
      type: 'varchar',
      length: 50,
      nullable: false  // 'hp_system', 'aether_system', 'damage_system', 'mastery_system', 'outcome_system'
    },
    minValue: {
      type: 'decimal',
      precision: 10,
      scale: 4,
      nullable: true
    },
    maxValue: {
      type: 'decimal',
      precision: 10,
      scale: 4,
      nullable: true
    },
    isPercentage: {
      type: 'boolean',
      nullable: false,
      default: false
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
      name: 'IDX_COMBAT_CONSTANT_CATEGORY',
      columns: ['category']
    },
    {
      name: 'IDX_COMBAT_CONSTANT_ACTIVE',
      columns: ['isActive']
    },
    {
      name: 'IDX_COMBAT_CONSTANT_KEY',
      columns: ['constantKey']
    }
  ]
});
