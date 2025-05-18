import { EntitySchema } from 'typeorm';

export const SessionParticipant = new EntitySchema({
  name: 'SessionParticipant',
  tableName: 'session_participants',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    sessionId: {
      type: 'int',
    },
    characterId: {
      type: 'int',
    },
    joinedAt: {
      type: 'timestamp',
      createDate: true,
    }
  },
  relations: {
    session: {
      type: 'many-to-one',
      target: 'Session',
      joinColumn: { name: 'sessionId' },
      inverseSide: 'participants'
    },
    character: {
      type: 'many-to-one',
      target: 'Character',
      joinColumn: { name: 'characterId' }
    }
  }
}); 