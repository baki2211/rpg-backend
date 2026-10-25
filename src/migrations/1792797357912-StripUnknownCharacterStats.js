/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

// Data only, no schema change. A stats update used to merge keys no stat definition knows into the
// "stats" jsonb with only a warning; it now refuses them (src/domain/character/stats.js#unknownStatKeys).
// This removes the keys older updates left behind. A key is kept when:
// - a stat_definitions row has it as "internalName", active or not (an inactive stat is not junk:
//   its value comes back into use if the definition is reactivated), or
// - it is a stat computeDerivedStats writes (DERIVED_STAT_NAMES below; reactions and speed have no row).
// With no stat_definitions rows at all nothing can tell a stat from junk, so no row is touched.
// "updatedAt" is left as is: it orders the active character (getActiveCharacter), and the stats
// a player sees don't change.
// The derived keys are frozen here on purpose; a migration must not change when the code does.

const DERIVED_STAT_NAMES = ['reactions', 'speed', 'hp', 'aether'];

/**
 * @class
 * @implements {MigrationInterface}
 */
export class StripUnknownCharacterStats1792797357912 {
    name = 'StripUnknownCharacterStats1792797357912'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        const [{ definitions }] = await queryRunner.query(`SELECT count(*)::int AS definitions FROM "stat_definitions"`);
        if (definitions === 0) {
            return;
        }
        await queryRunner.query(`
            UPDATE "characters" AS c
            SET "stats" = c."stats" - unknown.keys
            FROM (
                SELECT ch."id", array_agg(k.key) AS keys
                FROM "characters" AS ch
                CROSS JOIN LATERAL jsonb_object_keys(
                    CASE WHEN jsonb_typeof(ch."stats") = 'object' THEN ch."stats" ELSE '{}'::jsonb END
                ) AS k(key)
                WHERE k.key <> ALL($1::text[])
                  AND NOT EXISTS (SELECT 1 FROM "stat_definitions" AS d WHERE d."internalName" = k.key)
                GROUP BY ch."id"
            ) AS unknown
            WHERE c."id" = unknown."id"
        `, [DERIVED_STAT_NAMES]);
    }

    /**
     * No-op. The removed keys and their values are not recorded, so they can't be put back; they were
     * never read by any game rule (only stat definitions and derived stats are), so nothing depends on them.
     * @param {QueryRunner} _queryRunner
     */
    async down(_queryRunner) {}
}
