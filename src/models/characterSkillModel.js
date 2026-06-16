import { EntitySchema } from 'typeorm';
import { Character } from './characterModel.js';
import { Skill } from './skillModel.js';

export const CharacterSkill = new EntitySchema({
  name: 'CharacterSkill',
  tableName: 'character_skills',
  columns: {
    characterId: {
      primary: true,
      type: 'int',
    },
    skillId: {
      primary: true,
      type: 'int',
    },
    uses: {
      type: 'int',
      default: 0,
    },
    unlockedAt: {
      type: 'timestamp',
      default: () => 'now()',
    },
    rank: {
      type: 'int',
      default: 1,
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
      inverseSide: 'characterSkills',
      joinColumn: { name: 'characterId' },
      onDelete: 'CASCADE',
    },
    skill: {
      target: 'Skill',
      type: 'many-to-one',
      inverseSide: 'characterSkills',
      joinColumn: { name: 'skillId' },
      onDelete: 'CASCADE',
    },
  },
  indices: [
    {
      name: 'IDX_CHARACTER_SKILL_CHARACTER',
      columns: ['characterId'],
    },
    {
      name: 'IDX_CHARACTER_SKILL_SKILL',
      columns: ['skillId'],
    },
  ],
}); 