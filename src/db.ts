import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env

// Create a connection pool to PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER, 
    host: process.env.DB_HOST, 
    database: process.env.DB_NAME, 
    password: process.env.DB_PASSWORD, 
    port: parseInt(process.env.DB_PORT || '5432'),
});

pool.on('connect', () => {
    console.log('Connected to the database');
});

pool.on('error', (err) => {
    console.error('Database error:', err);
});
// Function to query the database
export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
};

export default pool;
