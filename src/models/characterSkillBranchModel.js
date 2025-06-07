import { EntitySchema } from 'typeorm';

export const CharacterSkillBranch = new EntitySchema({
  name: 'CharacterSkillBranch',
  tableName: 'character_skill_branches',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    characterId: {
      type: 'int',
      nullable: false
    },
    branchId: {
      type: 'int',
      nullable: false
    },
    uses: {
      type: 'int',
      default: 0,
      nullable: false
    },
    rank: {
      type: 'int',
      default: 1,
      nullable: false
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
    updatedAt: {
      type: 'timestamp',
      updateDate: true,
    },
  },
  relations: {
    character: {
      target: 'Character',
      type: 'many-to-one',
      joinColumn: { name: 'characterId' },
      onDelete: 'CASCADE',
    },
    branch: {
      target: 'SkillBranch',
      type: 'many-to-one',
      joinColumn: { name: 'branchId' },
      onDelete: 'CASCADE',
    },
  },
  indices: [
    {
      name: 'IDX_CHARACTER_SKILL_BRANCH_UNIQUE',
      columns: ['characterId', 'branchId'],
      unique: true
    }
  ]
}); 