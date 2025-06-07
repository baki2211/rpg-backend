export class AddScalingStatsColumn1735002000000 {
    async up(queryRunner) {
        // Check if scalingStats column exists
        const scalingStatsExists = await queryRunner.hasColumn("skills", "scalingStats");
        
        if (!scalingStatsExists) {
            // Add scalingStats column to skills table
            await queryRunner.query(`
                ALTER TABLE "skills" 
                ADD COLUMN "scalingStats" json DEFAULT '[]'
            `);
        }
    }

    async down(queryRunner) {
        // Remove scalingStats column from skills table if it exists
        const scalingStatsExists = await queryRunner.hasColumn("skills", "scalingStats");
        
        if (scalingStatsExists) {
            await queryRunner.query(`
                ALTER TABLE "skills" 
                DROP COLUMN "scalingStats"
            `);
        }
    }
} 