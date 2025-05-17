import { EntitySchema } from 'typeorm';

export const SkillType = new EntitySchema({
  name: 'SkillType',
  tableName: 'skill_types',
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
    }
  }
}); 