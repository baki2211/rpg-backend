import { Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateCombatTables1735500000000 {
    async up(queryRunner) {
        // Create combat_rounds table
        await queryRunner.createTable(new Table({
            name: 'combat_rounds',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'roundNumber',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'locationId',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'sessionId',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: "'active'",
                    isNullable: false
                },
                {
                    name: 'createdBy',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'resolvedBy',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'resolutionData',
                    type: 'json',
                    isNullable: true
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'resolvedAt',
                    type: 'timestamp',
                    isNullable: true
                }
            ]
        }), true);

        // Create combat_actions table
        await queryRunner.createTable(new Table({
            name: 'combat_actions',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'roundId',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'characterId',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'skillId',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'targetId',
                    type: 'int',
                    isNullable: true
                },
                {
                    name: 'finalOutput',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'outcomeMultiplier',
                    type: 'decimal',
                    precision: 3,
                    scale: 2,
                    isNullable: false
                },
                {
                    name: 'rollQuality',
                    type: 'varchar',
                    length: '20',
                    isNullable: false
                },
                {
                    name: 'skillData',
                    type: 'json',
                    isNullable: false
                },
                {
                    name: 'characterData',
                    type: 'json',
                    isNullable: false
                },
                {
                    name: 'targetData',
                    type: 'json',
                    isNullable: true
                },
                {
                    name: 'submittedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'processed',
                    type: 'boolean',
                    default: false
                },
                {
                    name: 'clashResult',
                    type: 'json',
                    isNullable: true
                }
            ]
        }), true);

        // Create indices
        await queryRunner.createIndex('combat_rounds', new TableIndex({
            name: 'IDX_COMBAT_ROUND_LOCATION',
            columnNames: ['locationId']
        }));

        await queryRunner.createIndex('combat_rounds', new TableIndex({
            name: 'IDX_COMBAT_ROUND_SESSION',
            columnNames: ['sessionId']
        }));

        await queryRunner.createIndex('combat_actions', new TableIndex({
            name: 'IDX_COMBAT_ACTION_ROUND',
            columnNames: ['roundId']
        }));

        await queryRunner.createIndex('combat_actions', new TableIndex({
            name: 'IDX_COMBAT_ACTION_CHARACTER',
            columnNames: ['characterId']
        }));

        await queryRunner.createIndex('combat_actions', new TableIndex({
            name: 'IDX_COMBAT_ACTION_UNIQUE_PER_ROUND',
            columnNames: ['roundId', 'characterId'],
            isUnique: true
        }));

        // Create foreign keys
        await queryRunner.createForeignKey('combat_rounds', new TableForeignKey({
            columnNames: ['sessionId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'sessions',
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('combat_actions', new TableForeignKey({
            columnNames: ['roundId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'combat_rounds',
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('combat_actions', new TableForeignKey({
            columnNames: ['characterId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'characters',
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('combat_actions', new TableForeignKey({
            columnNames: ['skillId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'skills',
            onDelete: 'CASCADE'
        }));

        await queryRunner.createForeignKey('combat_actions', new TableForeignKey({
            columnNames: ['targetId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'characters',
            onDelete: 'CASCADE'
        }));
    }

    async down(queryRunner) {
        // Drop foreign keys
        const combatRoundsTable = await queryRunner.getTable('combat_rounds');
        const combatActionsTable = await queryRunner.getTable('combat_actions');

        if (combatActionsTable) {
            const foreignKeys = combatActionsTable.foreignKeys;
            for (const fk of foreignKeys) {
                await queryRunner.dropForeignKey('combat_actions', fk);
            }
        }

        if (combatRoundsTable) {
            const foreignKeys = combatRoundsTable.foreignKeys;
            for (const fk of foreignKeys) {
                await queryRunner.dropForeignKey('combat_rounds', fk);
            }
        }

        // Drop tables
        await queryRunner.dropTable('combat_actions', true);
        await queryRunner.dropTable('combat_rounds', true);
    }
} 