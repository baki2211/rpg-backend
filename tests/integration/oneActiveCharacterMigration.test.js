import { describe, it, expect } from 'vitest';
import { AppDataSource } from '../../src/data-source.js';
import { OneActiveCharacterPerUser1792793875729 } from '../../src/migrations/1792793875729-OneActiveCharacterPerUser.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter } from './support/factories.js';

// The migration that adds IDX_CHARACTER_ONE_ACTIVE_PER_USER first cleans up older data with several
// active rows per user. To recreate that data the index is dropped; it is always rebuilt at the end
// so the files that run after this one see the migrated schema.

const INDEX = 'IDX_CHARACTER_ONE_ACTIVE_PER_USER';

const setUpdatedAt = (character, updatedAt) =>
  query(`UPDATE characters SET "updatedAt" = $2 WHERE id = $1`, [character.id, updatedAt]);

async function restoreIndex() {
  // Rows left by a failed run could block the index; the next test truncates them anyway.
  await query(`TRUNCATE characters CASCADE`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "characters" ("userId") WHERE "isActive" = true`);
}

describe('the one-active-character migration on a user with several active rows', () => {
  it('keeps the latest row active, demotes own characters and releases the controlled NPC', async () => {
    await query(`DROP INDEX "public"."${INDEX}"`);
    const queryRunner = AppDataSource.createQueryRunner();
    try {
      const player = await makeUser();
      const older = await makeCharacter({ user: player, isActive: true });
      const npc = await makeCharacter({ user: player, isNPC: true, isActive: true });
      const latest = await makeCharacter({ user: player, isActive: true });
      await setUpdatedAt(older, '2026-01-01T00:00:00');
      await setUpdatedAt(npc, '2026-02-01T00:00:00');
      await setUpdatedAt(latest, '2026-03-01T00:00:00');

      await new OneActiveCharacterPerUser1792793875729().up(queryRunner);

      expect(await query(`SELECT id, "userId", "isActive" FROM characters ORDER BY id`)).toEqual([
        { id: older.id, userId: player.id, isActive: false },
        { id: npc.id, userId: null, isActive: false },
        { id: latest.id, userId: player.id, isActive: true },
      ]);
      expect(await query(`SELECT indexdef FROM pg_indexes WHERE indexname = $1`, [INDEX])).toEqual([
        { indexdef: `CREATE UNIQUE INDEX "${INDEX}" ON public.characters USING btree ("userId") WHERE ("isActive" = true)` },
      ]);
    } finally {
      await queryRunner.release();
      await restoreIndex();
    }
  });
});
