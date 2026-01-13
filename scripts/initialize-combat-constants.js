#!/usr/bin/env node

/**
 * Initialize Combat Constants
 *
 * This script initializes the default combat constants from system.txt.
 * It's safe to run multiple times (idempotent) and won't create duplicates.
 *
 * Usage:
 *   node scripts/initialize-combat-constants.js
 */

import { AppDataSource } from '../src/data-source.js';
import { CombatConstantService } from '../src/services/CombatConstantService.js';

async function initializeCombatConstants() {
    try {
        console.log('🔌 Connecting to database...');
        await AppDataSource.initialize();
        console.log('✅ Database connected');

        console.log('🚀 Initializing combat constants...');
        const combatConstantService = new CombatConstantService();
        const result = await combatConstantService.initializeDefaultConstants();

        console.log(`✅ Successfully created ${result.createdConstants} combat constants`);

        if (result.createdConstants === 0) {
            console.log('ℹ️  All constants already exist (no duplicates created)');
        } else {
            console.log('\n📊 Created constants:');
            result.constants.forEach(constant => {
                console.log(`   - ${constant.constantKey} (${constant.category}): ${constant.value}`);
            });
        }

        // Close connection
        await AppDataSource.destroy();
        console.log('🔌 Database connection closed');

        process.exit(0);
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(1);
    }
}

initializeCombatConstants();
