import { describe, it, expect } from 'vitest';
import { AppDataSource } from '../../src/data-source.js';
import { StripUnknownCharacterStats1792797357912 } from '../../src/migrations/1792797357912-StripUnknownCharacterStats.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeStatDefinition } from './support/factories.js';

// L32: stats updates saved before unknown keys were refused left those keys in the `stats` jsonb.

async function runMigration() {
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await new StripUnknownCharacterStats1792797357912().up(queryRunner);
  } finally {
    await queryRunner.release();
  }
}

const statsAndUpdatedAt = () =>
  query(`SELECT id, stats, "updatedAt"::text AS "updatedAt" FROM characters ORDER BY id`);

describe('the migration that strips unknown character stats', () => {
  it('removes only the keys no stat definition or derived stat knows', async () => {
    await makeStatDefinition({ internalName: 'foc', displayName: 'Focus', category: 'primary_stat' });
    await makeStatDefinition({ internalName: 'old', displayName: 'Old Stat', category: 'primary_stat', isActive: false });
    const player = await makeUser();
    const messy = await makeCharacter({
      user: player,
      stats: { foc: 10, old: 4, hp: 50, aether: 30, reactions: 5, speed: 3, luck: 99, zeal: 1 },
    });
    const clean = await makeCharacter({ user: player, isActive: false, stats: { foc: 8, hp: 40 } });
    const onlyJunk = await makeCharacter({ user: player, isActive: false, stats: { luck: 3 } });
    await query(`UPDATE characters SET "updatedAt" = '2026-01-01 00:00:00'`);

    await runMigration();

    expect(await statsAndUpdatedAt()).toEqual([
      { id: messy.id, stats: { foc: 10, old: 4, hp: 50, aether: 30, reactions: 5, speed: 3 }, updatedAt: '2026-01-01 00:00:00' },
      { id: clean.id, stats: { foc: 8, hp: 40 }, updatedAt: '2026-01-01 00:00:00' },
      { id: onlyJunk.id, stats: {}, updatedAt: '2026-01-01 00:00:00' },
    ]);
  });

  it('leaves every row as is when there are no stat definitions to tell stats from junk', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { foc: 10, hp: 50, luck: 99 } });

    await runMigration();

    expect(await query(`SELECT id, stats FROM characters`)).toEqual([
      { id: character.id, stats: { foc: 10, hp: 50, luck: 99 } },
    ]);
  });
});
