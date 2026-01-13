#!/usr/bin/env node

/**
 * Database Migration Runner
 *
 * This script runs database migrations programmatically using the database connection
 * from your .env file. It's production-safe and can be run in any environment.
 *
 * Usage:
 *   node scripts/run-migration.js <migration-file.sql>
 *
 * Example:
 *   node scripts/run-migration.js src/migrations/create_combat_constants_table.sql
 */

import { AppDataSource } from '../src/data-source.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile) {
    try {
        // Resolve the migration file path
        const migrationPath = path.resolve(process.cwd(), migrationFile);

        if (!fs.existsSync(migrationPath)) {
            console.error(`❌ Migration file not found: ${migrationPath}`);
            process.exit(1);
        }

        console.log(`📄 Reading migration file: ${migrationPath}`);
        const sql = fs.readFileSync(migrationPath, 'utf8');

        // Initialize database connection
        console.log('🔌 Connecting to database...');
        await AppDataSource.initialize();
        console.log('✅ Database connected');

        // Execute the migration
        console.log('🚀 Running migration...');
        await AppDataSource.query(sql);
        console.log('✅ Migration completed successfully');

        // Close connection
        await AppDataSource.destroy();
        console.log('🔌 Database connection closed');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(1);
    }
}

// Get migration file from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Usage: node scripts/run-migration.js <migration-file.sql>');
    console.error('Example: node scripts/run-migration.js src/migrations/create_combat_constants_table.sql');
    process.exit(1);
}

runMigration(migrationFile);
