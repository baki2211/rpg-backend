import { Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'rpg_game'
});

const Player = sequelize.define('Player', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true
        }
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    experience: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    health: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    mana: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    inventory: {
        type: DataTypes.JSONB, // Using JSONB for better performance in PostgreSQL
        defaultValue: []
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

export default Player;