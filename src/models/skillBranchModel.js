import { EntitySchema } from 'typeorm';

export const SkillBranch = new EntitySchema({
  name: 'SkillBranch',
  tableName: 'skill_branches',
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