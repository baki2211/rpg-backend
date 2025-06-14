import { EntitySchema } from 'typeorm';

export const WikiSection = new EntitySchema({
  name: 'WikiSection',
  tableName: 'wiki_sections',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      length: 100,
      nullable: false,
    },
    slug: {
      type: 'varchar',
      length: 100,
      nullable: false,
      unique: true,
    },
    description: {
      type: 'text',
      nullable: true,
    },
    position: {
      type: 'int',
      nullable: false,
      default: 0,
    },
    isActive: {
      type: 'boolean',
      nullable: false,
      default: true,
    },
    createdBy: {
      type: 'int',
      nullable: false,
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
    creator: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'createdBy' },
      onDelete: 'CASCADE',
    },
    entries: {
      target: 'WikiEntry',
      type: 'one-to-many',
      inverseSide: 'section',
    },
  },
  indices: [
    {
      name: 'IDX_WIKI_SECTION_SLUG',
      columns: ['slug'],
      unique: true,
    },
    {
      name: 'IDX_WIKI_SECTION_POSITION',
      columns: ['position'],
    },
  ],
}); 