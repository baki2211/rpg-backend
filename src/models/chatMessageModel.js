import { EntitySchema} from 'typeorm';

export const ChatMessage = new EntitySchema({
  name: 'ChatMessage',
  tableName: 'chat_messages',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    userId: {
      type: 'int',
    },
    username: {
      type: 'varchar',
      length: 100,
    },
    message: {
      type: 'text',
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
  },
  relations: {
    location: {
      target: 'Location',
      type: 'many-to-one',
      onDelete: 'CASCADE',
    },
  },
});
