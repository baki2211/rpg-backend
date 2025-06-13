export class RemoveFrozenStateFromSessions1749333000000 {
    async up(queryRunner) {
        // Check if frozenState column exists
        const frozenStateExists = await queryRunner.hasColumn("sessions", "frozenState");
        
        if (frozenStateExists) {
            // Remove frozenState column from sessions table
            await queryRunner.query(`
                ALTER TABLE "sessions" 
                DROP COLUMN "frozenState"
            `);
            
            console.log('✅ Removed frozenState column from sessions table (no longer needed with new freeze logic)');
        } else {
            console.log('ℹ️ frozenState column does not exist in sessions table');
        }
    }

    async down(queryRunner) {
        // Add frozenState column back if needed for rollback
        const frozenStateExists = await queryRunner.hasColumn("sessions", "frozenState");
        
        if (!frozenStateExists) {
            await queryRunner.query(`
                ALTER TABLE "sessions" 
                ADD COLUMN "frozenState" text DEFAULT NULL
            `);
            
            console.log('✅ Added frozenState column back to sessions table');
        } else {
            console.log('ℹ️ frozenState column already exists in sessions table');
        }
    }
} 