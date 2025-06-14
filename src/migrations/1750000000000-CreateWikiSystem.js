export class CreateWikiSystem1750000000000 {
    async up(queryRunner) {
        // Create wiki_sections table
        await queryRunner.query(`
            CREATE TABLE "wiki_sections" (
                "id" SERIAL NOT NULL,
                "name" varchar(100) NOT NULL,
                "slug" varchar(100) NOT NULL,
                "description" text,
                "position" integer NOT NULL DEFAULT 0,
                "isActive" boolean NOT NULL DEFAULT true,
                "createdBy" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_wiki_sections" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_wiki_sections_slug" UNIQUE ("slug")
            )
        `);

        // Create wiki_entries table
        await queryRunner.query(`
            CREATE TABLE "wiki_entries" (
                "id" SERIAL NOT NULL,
                "sectionId" integer NOT NULL,
                "title" varchar(200) NOT NULL,
                "slug" varchar(200) NOT NULL,
                "content" text NOT NULL,
                "excerpt" text,
                "tags" json DEFAULT '[]',
                "isPublished" boolean NOT NULL DEFAULT true,
                "position" integer NOT NULL DEFAULT 0,
                "viewCount" integer NOT NULL DEFAULT 0,
                "createdBy" integer NOT NULL,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_wiki_entries" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for wiki_sections
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_WIKI_SECTION_SLUG" ON "wiki_sections" ("slug")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_WIKI_SECTION_POSITION" ON "wiki_sections" ("position")
        `);

        // Create indexes for wiki_entries
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_WIKI_ENTRY_SECTION_SLUG" ON "wiki_entries" ("sectionId", "slug")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_WIKI_ENTRY_SECTION_POSITION" ON "wiki_entries" ("sectionId", "position")
        `);
        
        await queryRunner.query(`
            CREATE INDEX "IDX_WIKI_ENTRY_PUBLISHED" ON "wiki_entries" ("isPublished")
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "wiki_sections" 
            ADD CONSTRAINT "FK_wiki_sections_createdBy" 
            FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "wiki_entries" 
            ADD CONSTRAINT "FK_wiki_entries_sectionId" 
            FOREIGN KEY ("sectionId") REFERENCES "wiki_sections"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "wiki_entries" 
            ADD CONSTRAINT "FK_wiki_entries_createdBy" 
            FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
        `);

        // Insert default sections
        await queryRunner.query(`
            INSERT INTO "wiki_sections" ("name", "slug", "description", "position", "createdBy") VALUES
            ('Races', 'races', 'Information about the various races in the world', 1, 1),
            ('Geography', 'geography', 'Locations, regions, and world geography', 2, 1),
            ('History', 'history', 'Historical events and chronicles', 3, 1),
            ('Organizations', 'organizations', 'Guilds, factions, and notable groups', 4, 1),
            ('Magic System', 'magic-system', 'How magic works in this world', 5, 1),
            ('Notable Figures', 'notable-figures', 'Important NPCs and historical figures', 6, 1)
        `);

        // Insert sample entries
        await queryRunner.query(`
            INSERT INTO "wiki_entries" ("sectionId", "title", "slug", "content", "excerpt", "tags", "position", "createdBy") VALUES
            (1, 'Character Creation Guide', 'character-creation-guide', 
             '# Character Creation Guide\n\nWelcome to character creation! This guide will help you understand how to create your character.\n\n## Primary Stats\n\nYour character has six primary stats:\n\n- **Focus (FOC)**: Mental concentration and magical aptitude\n- **Control (CON)**: Precision and finesse in actions\n- **Resilience (RES)**: Physical and mental toughness\n- **Instinct (INS)**: Natural reflexes and intuition\n- **Presence (PRE)**: Charisma and leadership ability\n- **Force (FOR)**: Raw physical power and strength\n\n## Stat Point Distribution\n\nYou have 45 points to distribute among your primary stats. Each stat starts at 0 and can go up to 15 during character creation.\n\n## Resource Stats\n\nThese are calculated automatically based on your primary stats:\n\n- **Health Points (HP)**: Your physical vitality\n- **Aether Energy**: Used for magical abilities\n- **Reactions**: How quickly you respond to threats\n- **Speed**: Your movement and action speed',
             'A comprehensive guide to creating your character, including stat distribution and understanding the game mechanics.',
             '["character creation", "stats", "guide", "new players"]', 1, 1),
            (2, 'The Central Continent', 'central-continent',
             '# The Central Continent\n\nThe Central Continent is the primary landmass where most of our adventures take place.\n\n## Major Regions\n\n### The Northern Reaches\nA cold, mountainous region known for its hardy inhabitants and rich mineral deposits.\n\n### The Verdant Plains\nRolling grasslands perfect for agriculture and trade routes.\n\n### The Southern Archipelago\nA collection of tropical islands with unique cultures and maritime traditions.\n\n## Climate\n\nThe continent experiences diverse climates, from the frigid north to the tropical south.',
             'An overview of the Central Continent, the main setting for adventures.',
             '["geography", "continent", "regions", "world"]', 1, 1)
        `);
    }

    async down(queryRunner) {
        // Drop foreign key constraints first
        await queryRunner.query(`ALTER TABLE "wiki_entries" DROP CONSTRAINT "FK_wiki_entries_createdBy"`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" DROP CONSTRAINT "FK_wiki_entries_sectionId"`);
        await queryRunner.query(`ALTER TABLE "wiki_sections" DROP CONSTRAINT "FK_wiki_sections_createdBy"`);
        
        // Drop tables
        await queryRunner.query(`DROP TABLE "wiki_entries"`);
        await queryRunner.query(`DROP TABLE "wiki_sections"`);
    }
} 