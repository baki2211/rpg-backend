export class RemoveLegacyStatBonuses1749600000000 {
    async up(queryRunner) {
        // Remove legacy stat bonus columns from races table if they exist
        const hasStrengthBonus = await queryRunner.hasColumn('races', 'strengthBonus');
        if (hasStrengthBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "strengthBonus"`);
        }

        const hasAgilityBonus = await queryRunner.hasColumn('races', 'agilityBonus');
        if (hasAgilityBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "agilityBonus"`);
        }

        const hasIntelligenceBonus = await queryRunner.hasColumn('races', 'intelligenceBonus');
        if (hasIntelligenceBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "intelligenceBonus"`);
        }

        const hasArmorBonus = await queryRunner.hasColumn('races', 'armorBonus');
        if (hasArmorBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "armorBonus"`);
        }

        console.log('✅ Legacy stat bonuses removed from races table');
    }

    async down(queryRunner) {
        // Add back the legacy stat bonus columns if needed
        const hasStrengthBonus = await queryRunner.hasColumn('races', 'strengthBonus');
        if (!hasStrengthBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "strengthBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasAgilityBonus = await queryRunner.hasColumn('races', 'agilityBonus');
        if (!hasAgilityBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "agilityBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasIntelligenceBonus = await queryRunner.hasColumn('races', 'intelligenceBonus');
        if (!hasIntelligenceBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "intelligenceBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasArmorBonus = await queryRunner.hasColumn('races', 'armorBonus');
        if (!hasArmorBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "armorBonus" integer NOT NULL DEFAULT 0`);
        }

        console.log('✅ Legacy stat bonuses restored to races table');
    }
} 