export class AddEventSessionFields1735520000000 {
    async up(queryRunner) {
        // Add isEvent boolean column with default false
        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD COLUMN "isEvent" boolean DEFAULT false NOT NULL
        `);

        // Add eventId integer column that can be null
        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD COLUMN "eventId" integer
        `);

        // Add foreign key constraint for eventId
        await queryRunner.query(`
            ALTER TABLE "sessions" 
            ADD CONSTRAINT "FK_sessions_eventId" 
            FOREIGN KEY ("eventId") REFERENCES "events"("id") 
            ON DELETE SET NULL
        `);

        // Create index for better performance on eventId lookups
        await queryRunner.query(`
            CREATE INDEX "IDX_sessions_eventId" ON "sessions" ("eventId")
        `);

        // Create index for isEvent field for filtering
        await queryRunner.query(`
            CREATE INDEX "IDX_sessions_isEvent" ON "sessions" ("isEvent")
        `);

        console.log('✅ Added isEvent and eventId fields to sessions table');
    }

    async down(queryRunner) {
        // Remove indexes
        await queryRunner.query(`DROP INDEX "IDX_sessions_isEvent"`);
        await queryRunner.query(`DROP INDEX "IDX_sessions_eventId"`);
        
        // Remove foreign key constraint
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_eventId"`);
        
        // Remove columns
        await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "eventId"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "isEvent"`);

        console.log('✅ Removed isEvent and eventId fields from sessions table');
    }
} 