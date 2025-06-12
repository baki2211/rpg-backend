export class AddNewStatBonusesToRace1749500000000 {
    async up(queryRunner) {
        // Add new stat bonus columns to races table if they don't exist
        const hasFocusBonus = await queryRunner.hasColumn('races', 'focusBonus');
        if (!hasFocusBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "focusBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasControlBonus = await queryRunner.hasColumn('races', 'controlBonus');
        if (!hasControlBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "controlBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasResilienceBonus = await queryRunner.hasColumn('races', 'resilienceBonus');
        if (!hasResilienceBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "resilienceBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasInstinctBonus = await queryRunner.hasColumn('races', 'instinctBonus');
        if (!hasInstinctBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "instinctBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasPresenceBonus = await queryRunner.hasColumn('races', 'presenceBonus');
        if (!hasPresenceBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "presenceBonus" integer NOT NULL DEFAULT 0`);
        }

        const hasForceBonus = await queryRunner.hasColumn('races', 'forceBonus');
        if (!hasForceBonus) {
            await queryRunner.query(`ALTER TABLE "races" ADD COLUMN "forceBonus" integer NOT NULL DEFAULT 0`);
        }

        console.log('✅ New stat bonuses migration applied to races table');
    }

    async down(queryRunner) {
        // Remove the new stat bonus columns if they exist
        const hasForceBonus = await queryRunner.hasColumn('races', 'forceBonus');
        if (hasForceBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "forceBonus"`);
        }

        const hasPresenceBonus = await queryRunner.hasColumn('races', 'presenceBonus');
        if (hasPresenceBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "presenceBonus"`);
        }

        const hasInstinctBonus = await queryRunner.hasColumn('races', 'instinctBonus');
        if (hasInstinctBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "instinctBonus"`);
        }

        const hasResilienceBonus = await queryRunner.hasColumn('races', 'resilienceBonus');
        if (hasResilienceBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "resilienceBonus"`);
        }

        const hasControlBonus = await queryRunner.hasColumn('races', 'controlBonus');
        if (hasControlBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "controlBonus"`);
        }

        const hasFocusBonus = await queryRunner.hasColumn('races', 'focusBonus');
        if (hasFocusBonus) {
            await queryRunner.query(`ALTER TABLE "races" DROP COLUMN "focusBonus"`);
        }

        console.log('✅ New stat bonuses migration reverted from races table');
    }
} 