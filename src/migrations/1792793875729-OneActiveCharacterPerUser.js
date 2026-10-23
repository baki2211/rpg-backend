/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

// A user plays one character at a time: their own character or the NPC they control (an NPC under
// control carries the controller's userId). Activation already keeps a single active row per user;
// this index makes the database enforce it. Rows with a NULL userId (uncontrolled NPCs) never conflict.
// Older data may still have several active rows per user: all but the one the app reads today
// (latest "updatedAt", ties -> highest id, as getActiveCharacter orders) are deactivated first.
// A demoted NPC is also released (userId NULL), as every activation path does when it drops control.

/**
 * @class
 * @implements {MigrationInterface}
 */
export class OneActiveCharacterPerUser1792793875729 {
    name = 'OneActiveCharacterPerUser1792793875729'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`
            UPDATE "characters" AS c
            SET "isActive" = false, "userId" = CASE WHEN c."isNPC" THEN NULL ELSE c."userId" END
            FROM (
                SELECT "id", row_number() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "id" DESC) AS rn
                FROM "characters"
                WHERE "isActive" = true AND "userId" IS NOT NULL
            ) AS ranked
            WHERE c."id" = ranked."id" AND ranked.rn > 1
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_CHARACTER_ONE_ACTIVE_PER_USER" ON "characters"  ("userId") WHERE "isActive" = true`);
    }

    /**
     * Drops the index only. The rows deactivated by up() are not reactivated: which ones were
     * duplicates is not recorded, and reactivating them would recreate the conflict.
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_CHARACTER_ONE_ACTIVE_PER_USER"`);
    }
}
