export class AddSkillTargetField1735001000000 {
    async up(queryRunner) {
        // Add target column to skills table
        await queryRunner.query(`
            ALTER TABLE "skills" 
            ADD COLUMN "target" varchar(10) NOT NULL DEFAULT 'other'
        `);

        // Add check constraint to ensure valid target values
        await queryRunner.query(`
            ALTER TABLE "skills" 
            ADD CONSTRAINT "CHK_skill_target" 
            CHECK ("target" IN ('self', 'other', 'none'))
        `);
    }

    async down(queryRunner) {
        // Remove the constraint first
        await queryRunner.query(`
            ALTER TABLE "skills" 
            DROP CONSTRAINT "CHK_skill_target"
        `);

        // Remove target column from skills table
        await queryRunner.query(`
            ALTER TABLE "skills" 
            DROP COLUMN "target"
        `);
    }
} 