import { EntitySchema } from 'typeorm';

export const WikiEntry = new EntitySchema({
  name: 'WikiEntry',
  tableName: 'wiki_entries',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    sectionId: {
      type: 'int',
      nullable: false,
    },
    title: {
      type: 'varchar',
      length: 200,
      nullable: false,
    },
    slug: {
      type: 'varchar',
      length: 200,
      nullable: false,
    },
    content: {
      type: 'text',
      nullable: false,
    },
    excerpt: {
      type: 'text',
      nullable: true,
    },
    tags: {
      type: 'jsonb',
      nullable: true,
      default: () => "'[]'",
    },
    isPublished: {
      type: 'boolean',
      nullable: false,
      default: true,
    },
    position: {
      type: 'int',
      nullable: false,
      default: 0,
    },
    parentEntryId: {
      type: 'int',
      nullable: true,
    },
    level: {
      type: 'int',
      nullable: false,
      default: 1,
    },
    viewCount: {
      type: 'int',
      nullable: false,
      default: 0,
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
    section: {
      target: 'WikiSection',
      type: 'many-to-one',
      joinColumn: { name: 'sectionId' },
      inverseSide: 'entries',
      onDelete: 'CASCADE',
    },
    creator: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'createdBy' },
      onDelete: 'CASCADE',
    },
    parentEntry: {
      target: 'WikiEntry',
      type: 'many-to-one',
      joinColumn: { name: 'parentEntryId' },
      nullable: true,
    },
    childEntries: {
      target: 'WikiEntry',
      type: 'one-to-many',
      inverseSide: 'parentEntry',
    },
  },
  indices: [
    {
      name: 'IDX_WIKI_ENTRY_SECTION_SLUG',
      columns: ['sectionId', 'slug'],
      unique: true,
    },
    {
      name: 'IDX_WIKI_ENTRY_SECTION_POSITION',
      columns: ['sectionId', 'position'],
    },
    {
      name: 'IDX_WIKI_ENTRY_PUBLISHED',
      columns: ['isPublished'],
    },
    {
      name: 'IDX_WIKI_ENTRY_TAGS',
      columns: ['tags'],
    },
    {
      name: 'IDX_WIKI_ENTRY_PARENT',
      columns: ['parentEntryId'],
    },
    {
      name: 'IDX_WIKI_ENTRY_LEVEL',
      columns: ['level'],
    },
  ],
}); 