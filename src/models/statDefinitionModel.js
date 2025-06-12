import { EntitySchema } from 'typeorm';

export const StatDefinition = new EntitySchema({
  name: 'StatDefinition',
  tableName: 'stat_definitions',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    internalName: {
      type: 'varchar',
      length: 50,
      nullable: false,
      unique: true  // e.g., 'stat1', 'hp', 'aether', 'focus', 'control'
    },
    displayName: {
      type: 'varchar',
      length: 100,
      nullable: false  // e.g., 'Strength', 'Health Points', 'Aether Energy'
    },
    description: {
      type: 'text',
      nullable: true
    },
    category: {
      type: 'varchar',
      length: 20,
      nullable: false  // 'primary_stat', 'resource', 'scaling_stat'
    },
    defaultValue: {
      type: 'int',
      nullable: false,
      default: 0
    },
    maxValue: {
      type: 'int',
      nullable: true,  // null values will be treated as 100 by the service layer
      default: 100     // Default to 100 for new stat definitions
    },
    minValue: {
      type: 'int',
      nullable: false,
      default: 0
    },
    isActive: {
      type: 'boolean',
      nullable: false,
      default: true
    },
    sortOrder: {
      type: 'int',
      nullable: false,
      default: 0  // For ordering in UI
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
      name: 'IDX_STAT_DEFINITION_CATEGORY',
      columns: ['category']
    },
    {
      name: 'IDX_STAT_DEFINITION_ACTIVE',
      columns: ['isActive']
    }
  ]
}); 