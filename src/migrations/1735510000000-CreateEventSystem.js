 export class CreateEventSystem1735510000000 {
    async up(queryRunner) {
        // Create events table
        await queryRunner.query(`
            CREATE TABLE events (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('lore', 'duel', 'quest')),
                description TEXT,
                "locationId" INTEGER NOT NULL,
                "sessionId" INTEGER,
                status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
                "createdBy" INTEGER NOT NULL,
                "closedBy" INTEGER,
                "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "closedAt" TIMESTAMP,
                "eventData" JSON
            )
        `);

        // Add indexes for events table
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_LOCATION" ON events ("locationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_SESSION" ON events ("sessionId")`);
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_STATUS" ON events (status)`);

        // Add eventId column to combat_rounds table
        await queryRunner.query(`
            ALTER TABLE combat_rounds 
            ADD COLUMN "eventId" INTEGER
        `);

        // Add index for eventId in combat_rounds
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ROUND_EVENT" ON combat_rounds ("eventId")`);

        // Add foreign key constraint for eventId
        await queryRunner.query(`
            ALTER TABLE combat_rounds 
            ADD CONSTRAINT "FK_combat_rounds_event" 
            FOREIGN KEY ("eventId") REFERENCES events(id) 
            ON DELETE SET NULL
        `);
    }

    async down(queryRunner) {
        // Remove foreign key constraint
        await queryRunner.query(`ALTER TABLE combat_rounds DROP CONSTRAINT "FK_combat_rounds_event"`);
        
        // Remove index from combat_rounds
        await queryRunner.query(`DROP INDEX "IDX_COMBAT_ROUND_EVENT"`);
        
        // Remove eventId column from combat_rounds
        await queryRunner.query(`ALTER TABLE combat_rounds DROP COLUMN "eventId"`);
        
        // Drop indexes from events table
        await queryRunner.query(`DROP INDEX "IDX_EVENT_STATUS"`);
        await queryRunner.query(`DROP INDEX "IDX_EVENT_SESSION"`);
        await queryRunner.query(`DROP INDEX "IDX_EVENT_LOCATION"`);
        
        // Drop events table
        await queryRunner.query(`DROP TABLE events`);
    }
} 