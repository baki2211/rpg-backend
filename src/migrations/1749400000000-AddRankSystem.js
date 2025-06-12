export class AddRankSystem1749400000000 {
  async up(queryRunner) {
    // Add columns to characters table if they don't exist
    const hasRank = await queryRunner.hasColumn('characters', 'rank');
    if (!hasRank) {
      await queryRunner.query(`ALTER TABLE "characters" ADD COLUMN "rank" integer NOT NULL DEFAULT 1`);
    }

    const hasStatPoints = await queryRunner.hasColumn('characters', 'statPoints');
    if (!hasStatPoints) {
      await queryRunner.query(`ALTER TABLE "characters" ADD COLUMN "statPoints" integer NOT NULL DEFAULT 0`);
    }

    // Create ranks table if it doesn't exist
    const hasRanksTable = await queryRunner.hasTable('ranks');
    if (!hasRanksTable) {
      await queryRunner.query(`
        CREATE TABLE "ranks" (
          "level" integer PRIMARY KEY,
          "requiredExperience" integer NOT NULL,
          "statPoints" integer NOT NULL DEFAULT 0,
          "skillPoints" integer NOT NULL DEFAULT 0,
          "aetherPercent" float NOT NULL DEFAULT 0,
          "hpPercent" float NOT NULL DEFAULT 0,
          "createdAt" timestamp DEFAULT now(),
          "updatedAt" timestamp DEFAULT now()
        )
      `);
      await queryRunner.query(`CREATE INDEX "IDX_ranks_level" ON "ranks" ("level")`);
    }

    console.log('✅ Rank system migration applied');
  }

  async down(queryRunner) {
    // Reverse index and table if they exist
    const hasRanksTable = await queryRunner.hasTable('ranks');
    if (hasRanksTable) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ranks_level"`);
      await queryRunner.query(`DROP TABLE "ranks"`);
    }

    const hasStatPoints = await queryRunner.hasColumn('characters', 'statPoints');
    if (hasStatPoints) {
      await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "statPoints"`);
    }

    const hasRank = await queryRunner.hasColumn('characters', 'rank');
    if (hasRank) {
      await queryRunner.query(`ALTER TABLE "characters" DROP COLUMN "rank"`);
    }

    console.log('✅ Rank system migration reverted');
  }
} 