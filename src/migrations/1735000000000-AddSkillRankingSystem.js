export class AddSkillRankingSystem1735000000000 {
    async up(queryRunner) {
        // Check and add skillPoints column to characters table if it doesn't exist
        const skillPointsExists = await queryRunner.hasColumn("characters", "skillPoints");
        if (!skillPointsExists) {
            await queryRunner.query(`
                ALTER TABLE "characters" 
                ADD COLUMN "skillPoints" integer NOT NULL DEFAULT 5
            `);
        }

        // Check and add skillPointCost column to skills table if it doesn't exist
        const skillPointCostExists = await queryRunner.hasColumn("skills", "skillPointCost");
        if (!skillPointCostExists) {
            await queryRunner.query(`
                ALTER TABLE "skills" 
                ADD COLUMN "skillPointCost" integer NOT NULL DEFAULT 1
            `);
        }

        // Check and add uses column to skill_branches table if it doesn't exist
        const branchUsesExists = await queryRunner.hasColumn("skill_branches", "uses");
        if (!branchUsesExists) {
            await queryRunner.query(`
                ALTER TABLE "skill_branches" 
                ADD COLUMN "uses" integer NOT NULL DEFAULT 0
            `);
        }

        // Check if character_skill_branches table exists
        const tableExists = await queryRunner.hasTable("character_skill_branches");
        if (!tableExists) {
            // Create character_skill_branches table
            await queryRunner.query(`
                CREATE TABLE "character_skill_branches" (
                    "id" SERIAL NOT NULL,
                    "characterId" integer NOT NULL,
                    "branchId" integer NOT NULL,
                    "uses" integer NOT NULL DEFAULT 0,
                    "rank" integer NOT NULL DEFAULT 1,
                    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_character_skill_branches" PRIMARY KEY ("id"),
                    CONSTRAINT "FK_character_skill_branches_character" 
                        FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE,
                    CONSTRAINT "FK_character_skill_branches_branch" 
                        FOREIGN KEY ("branchId") REFERENCES "skill_branches"("id") ON DELETE CASCADE
                )
            `);

            // Create unique index for characterId and branchId combination
            await queryRunner.query(`
                CREATE UNIQUE INDEX "IDX_CHARACTER_SKILL_BRANCH_UNIQUE" 
                ON "character_skill_branches" ("characterId", "branchId")
            `);

            // Create individual indexes for performance
            await queryRunner.query(`
                CREATE INDEX "IDX_CHARACTER_SKILL_BRANCH_CHARACTER" 
                ON "character_skill_branches" ("characterId")
            `);

            await queryRunner.query(`
                CREATE INDEX "IDX_CHARACTER_SKILL_BRANCH_BRANCH" 
                ON "character_skill_branches" ("branchId")
            `);
        }
    }

    async down(queryRunner) {
        // Drop the character_skill_branches table if it exists
        const tableExists = await queryRunner.hasTable("character_skill_branches");
        if (tableExists) {
            await queryRunner.query(`DROP TABLE "character_skill_branches"`);
        }

        // Remove uses column from skill_branches table if it exists
        const branchUsesExists = await queryRunner.hasColumn("skill_branches", "uses");
        if (branchUsesExists) {
            await queryRunner.query(`
                ALTER TABLE "skill_branches" 
                DROP COLUMN "uses"
            `);
        }

        // Remove skillPointCost column from skills table if it exists
        const skillPointCostExists = await queryRunner.hasColumn("skills", "skillPointCost");
        if (skillPointCostExists) {
            await queryRunner.query(`
                ALTER TABLE "skills" 
                DROP COLUMN "skillPointCost"
            `);
        }

        // Remove skillPoints column from characters table if it exists
        const skillPointsExists = await queryRunner.hasColumn("characters", "skillPoints");
        if (skillPointsExists) {
            await queryRunner.query(`
                ALTER TABLE "characters" 
                DROP COLUMN "skillPoints"
            `);
        }
    }
} 