export class RemoveScalingFactor1710000000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "skills" DROP COLUMN "scalingFactor"`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "skills" ADD "scalingFactor" float`);
    }
} 