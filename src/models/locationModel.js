import { EntitySchema} from 'typeorm';

export const Location = new EntitySchema({
  name: 'Location',
  tableName: 'locations',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      length: 100,
    },
    description: {
      type: 'text',
    },
    xCoordinate: {
      type: 'int',
    },
    yCoordinate: {
      type: 'int',
    },
  },
  relations: {
    map: {
      target: 'Map',
      type: 'many-to-one',
      inverseSide: 'locations',
      onDelete: 'CASCADE',
    },
  },
});
