import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
dotenv.config();


export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'dbuser',
    password: process.env.DB_PASSWORD || 'dbpassword',
    database: process.env.DB_NAME || 'dbname',
    synchronize: false, 
    logging: true, 
    entities: ['./src/models/*.js'],
    migrations: ['./src/migrations/*.js'],
});
