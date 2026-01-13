import { EntitySchema } from 'typeorm';

export const MasteryTier = new EntitySchema({
  name: 'MasteryTier',
  tableName: 'mastery_tiers',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    tier: {
      type: 'int',
      nullable: false
    },
    tierName: {
      type: 'varchar',
      length: 100,
      nullable: false
    },
    usesRequired: {
      type: 'int',
      nullable: false,
      default: 0
    },
    multiplier: {
      type: 'decimal',
      precision: 5,
      scale: 2,
      nullable: false,
      default: 1.00
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
      name: 'IDX_MASTERY_TIER',
      columns: ['tier']
    },
    {
      name: 'IDX_MASTERY_ACTIVE',
      columns: ['isActive']
    },
    {
      name: 'IDX_MASTERY_USES',
      columns: ['usesRequired']
    }
  ]
});
