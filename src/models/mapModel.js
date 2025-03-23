import { EntitySchema } from 'typeorm';

export const Map = new EntitySchema({
  name: 'Map',
  tableName: 'maps',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      length: 255,
    },
    imageUrl: {
      type: 'varchar',
    },
    isMainMap: {
      type: 'boolean',
      default: false,
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
  },
});
