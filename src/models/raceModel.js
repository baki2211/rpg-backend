import { EntitySchema } from 'typeorm';

export const Race = new EntitySchema({
    name: 'Race',
    tableName: 'races',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        name: {
            type: 'varchar',
            length: 100,
            unique: true,
        },
        description: {
            type: 'text',
        },
        image: {
            type: 'varchar',
            nullable: true,
        },
        healthBonus: {
            type: 'int',
            default: 0,
        },
        manaBonus: {
            type: 'int',
            default: 0,
        },
        strengthBonus: {
            type: 'int',
            default: 0,
        },
        agilityBonus: {
            type: 'int',
            default: 0,
        },
        intelligenceBonus: {
            type: 'int',
            default: 0,
        },
        speedBonus: {
            type: 'int',
            default: 0,
        },
        armorBonus: {
            type: 'int',
            default: 0,
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true,
        },
    },
    relations: {
        characters: {
            target: 'Character',
            type: 'one-to-many',
            inverseSide: 'race',
        },
    },
});