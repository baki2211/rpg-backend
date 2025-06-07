export class AddFrozenStateToSessions1749332000000 {
    async up(queryRunner) {
        // Check if frozenState column exists
        const frozenStateExists = await queryRunner.hasColumn("sessions", "frozenState");
        
        if (!frozenStateExists) {
            // Add frozenState column to sessions table
            await queryRunner.query(`
                ALTER TABLE "sessions" 
                ADD COLUMN "frozenState" text DEFAULT NULL
            `);
            
            console.log('✅ Added frozenState column to sessions table');
        } else {
            console.log('ℹ️ frozenState column already exists in sessions table');
        }
    }

    async down(queryRunner) {
        // Remove frozenState column from sessions table if it exists
        const frozenStateExists = await queryRunner.hasColumn("sessions", "frozenState");
        
        if (frozenStateExists) {
            await queryRunner.query(`
                ALTER TABLE "sessions" 
                DROP COLUMN "frozenState"
            `);
            
            console.log('✅ Removed frozenState column from sessions table');
        } else {
            console.log('ℹ️ frozenState column does not exist in sessions table');
        }
    }
} 