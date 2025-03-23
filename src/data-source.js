import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'rpg',
  synchronize: false, // Auto-sync database schema (set to false in production!)
  logging: true,
  entities: ['./src/models/*.js'], 
  migrations: ['./src/migrations/*.js'],
});