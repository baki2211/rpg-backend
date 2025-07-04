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
    characterId: {
      type: 'int',
      nullable: true,
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
    skillId: {
      type: 'int',
      nullable: true,
    },
    skillName: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    skillBranch: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    skillType: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    skillOutput: {
      type: 'int',
      nullable: true,
    },
    skillRoll: {
      type: 'varchar',
      length: 100,
      nullable: true,
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
