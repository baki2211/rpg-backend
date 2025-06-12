import { EntitySchema } from 'typeorm';

export const Rank = new EntitySchema({
  name: 'Rank',
  tableName: 'ranks',
  columns: {
    level: {
      primary: true,
      type: 'int'
    },
    requiredExperience: {
      type: 'int',
      nullable: false
    },
    statPoints: {
      type: 'int',
      nullable: false,
      default: 0
    },
    skillPoints: {
      type: 'int',
      nullable: false,
      default: 0
    },
    aetherPercent: {
      type: 'float',
      nullable: false,
      default: 0
    },
    hpPercent: {
      type: 'float',
      nullable: false,
      default: 0
    },
    createdAt: {
      type: 'timestamp',
      createDate: true
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true
    }
  }
}); 