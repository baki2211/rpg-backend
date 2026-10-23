/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

// Data only, no schema change. The engine now reads these rows (src/domain/skills/rules.js), so the
// seeded values are set to the numbers the code has always used, and gameplay does not change:
// - mastery_tiers 1..5 = skill rank ladder (uses 0/20/35/60/100, x1.0/1.3/1.7/2.2/2.8); tiers 6+ deactivated
// - MASTERY_TIER_1..10 = branch rank multipliers (1.0 .. 1.5)
// - OUTCOME_POOR_MULT 0.9 -> 0.6, OUTCOME_CRITICAL_MULT 1.15 -> 1.4
// Rows that don't exist are not created: missing rows fall back to the same code defaults.
// Values are frozen here on purpose; a migration must not change when the code defaults do.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const BRANCH_RANKS = [
    { minUses: 0, multiplier: 1.0 }, { minUses: 75, multiplier: 1.05 }, { minUses: 150, multiplier: 1.1 },
    { minUses: 250, multiplier: 1.15 }, { minUses: 375, multiplier: 1.2 }, { minUses: 525, multiplier: 1.25 },
    { minUses: 700, multiplier: 1.3 }, { minUses: 900, multiplier: 1.35 }, { minUses: 1125, multiplier: 1.4 },
    { minUses: 1375, multiplier: 1.5 },
];
const OLD_MASTERY_TIER_VALUES = [1.0, 1.08, 1.16, 1.24, 1.32, 1.40, 1.48, 1.55, 1.60, 1.65];

const SKILL_RANKS = [
    { tier: 1, usesRequired: 0, multiplier: 1.0 }, { tier: 2, usesRequired: 20, multiplier: 1.3 },
    { tier: 3, usesRequired: 35, multiplier: 1.7 }, { tier: 4, usesRequired: 60, multiplier: 2.2 },
    { tier: 5, usesRequired: 100, multiplier: 2.8 },
];
const OLD_TIERS = [
    { tier: 1, usesRequired: 0, multiplier: 1.0 }, { tier: 2, usesRequired: 20, multiplier: 1.08 },
    { tier: 3, usesRequired: 40, multiplier: 1.16 }, { tier: 4, usesRequired: 60, multiplier: 1.24 },
    { tier: 5, usesRequired: 80, multiplier: 1.32 },
];

const OUTCOMES = [
    { key: 'OUTCOME_POOR_MULT', value: 0.6, description: 'Skill output multiplier for a Poor success (d20 roll 1-3)' },
    { key: 'OUTCOME_STANDARD_MULT', value: 1.0, description: 'Skill output multiplier for a Standard success (d20 roll 4-17)' },
    { key: 'OUTCOME_CRITICAL_MULT', value: 1.4, description: 'Skill output multiplier for a Critical success (d20 roll 18-20)' },
];
const OLD_OUTCOMES = [
    { key: 'OUTCOME_POOR_MULT', value: 0.9, description: 'Damage multiplier for poor quality outcomes' },
    { key: 'OUTCOME_STANDARD_MULT', value: 1.0, description: 'Damage multiplier for standard quality outcomes' },
    { key: 'OUTCOME_CRITICAL_MULT', value: 1.15, description: 'Damage multiplier for critical quality outcomes (capped at 1.15 per system.txt)' },
];

/**
 * @class
 * @implements {MigrationInterface}
 */
export class AlignSkillRuleRows1792785496621 {
    name = 'AlignSkillRuleRows1792785496621'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        for (const [index, { minUses, multiplier }] of BRANCH_RANKS.entries()) {
            await queryRunner.query(
                `UPDATE "combat_constants" SET "value" = $1, "displayName" = $2, "description" = $3, "updatedAt" = now() WHERE "constantKey" = $4`,
                [multiplier, `Branch Rank ${ROMAN[index]} Multiplier`, `Branch rank multiplier once the branch has ${minUses} uses (rank ${index + 1})`, `MASTERY_TIER_${index + 1}`]
            );
        }
        for (const { key, value, description } of OUTCOMES) {
            await queryRunner.query(
                `UPDATE "combat_constants" SET "value" = $1, "description" = $2, "updatedAt" = now() WHERE "constantKey" = $3`,
                [value, description, key]
            );
        }
        for (const { tier, usesRequired, multiplier } of SKILL_RANKS) {
            await queryRunner.query(
                `UPDATE "mastery_tiers" SET "usesRequired" = $1, "multiplier" = $2, "updatedAt" = now() WHERE "tier" = $3`,
                [usesRequired, multiplier, tier]
            );
        }
        await queryRunner.query(`UPDATE "mastery_tiers" SET "isActive" = false, "updatedAt" = now() WHERE "tier" > 5`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`UPDATE "mastery_tiers" SET "isActive" = true, "updatedAt" = now() WHERE "tier" > 5`);
        for (const { tier, usesRequired, multiplier } of OLD_TIERS) {
            await queryRunner.query(
                `UPDATE "mastery_tiers" SET "usesRequired" = $1, "multiplier" = $2, "updatedAt" = now() WHERE "tier" = $3`,
                [usesRequired, multiplier, tier]
            );
        }
        for (const { key, value, description } of OLD_OUTCOMES) {
            await queryRunner.query(
                `UPDATE "combat_constants" SET "value" = $1, "description" = $2, "updatedAt" = now() WHERE "constantKey" = $3`,
                [value, description, key]
            );
        }
        for (const [index, value] of OLD_MASTERY_TIER_VALUES.entries()) {
            const name = index === 9 ? 'Mastery Tier X (Cap)' : `Mastery Tier ${ROMAN[index]}`;
            const description = index === 9 ? 'Tier X mastery multiplier (maximum)' : `Tier ${ROMAN[index]} mastery multiplier`;
            await queryRunner.query(
                `UPDATE "combat_constants" SET "value" = $1, "displayName" = $2, "description" = $3, "updatedAt" = now() WHERE "constantKey" = $4`,
                [value, name, description, `MASTERY_TIER_${index + 1}`]
            );
        }
    }
}
