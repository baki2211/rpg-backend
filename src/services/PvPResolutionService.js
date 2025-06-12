import { SkillEngine } from './SkillEngine.js';
import { SkillUsageService } from './SkillUsageService.js';

export class PvPResolutionService {
    
    /**
     * Resolve a PvP encounter between two characters using skills
     * @param {Object} attacker - The attacking character
     * @param {Object} attackerSkill - The skill used by the attacker
     * @param {Object} defender - The defending character  
     * @param {Object} defenderSkill - The skill used by the defender
     * @returns {Promise<Object>} Combat resolution result
     */
    static async resolvePvPEncounter(attacker, attackerSkill, defender, defenderSkill) {
        // Calculate both skill outputs
        const attackerEngine = new SkillEngine(attacker, attackerSkill);
        const defenderEngine = new SkillEngine(defender, defenderSkill);
        
        const [attackerOutput, defenderOutput] = await Promise.all([
            attackerEngine.computeFinalOutput(),
            defenderEngine.computeFinalOutput()
        ]);

        // Get the rolls for reporting (we need to capture them separately)
        const attackerRoll = attackerEngine.rollOutcome();
        const defenderRoll = defenderEngine.rollOutcome();

        // Determine if clash occurs and resolve
        const clashResult = this.determineClash(
            attackerSkill, 
            defenderSkill, 
            attackerOutput, 
            defenderOutput
        );

        // Build the combat report
        const report = [
            {
                actor: attacker.name,
                target: defenderSkill.target === 'self' ? attacker.name : defender.name,
                roll: this.getRollFromMultiplier(attackerRoll),
                skillType: attackerSkill.type?.name || 'Unknown',
                skillName: attackerSkill.name,
                output: attackerOutput
            },
            {
                actor: defender.name,
                target: defenderSkill.target === 'self' ? defender.name : attacker.name,
                roll: this.getRollFromMultiplier(defenderRoll),
                skillType: defenderSkill.type?.name || 'Unknown',
                skillName: defenderSkill.name,
                output: defenderOutput
            }
        ];

        // Increment skill usage for both characters
        await Promise.all([
            SkillUsageService.incrementSkillUsage(attacker.id, attackerSkill.id, attackerSkill.branchId),
            SkillUsageService.incrementSkillUsage(defender.id, defenderSkill.id, defenderSkill.branchId)
        ]);

        return {
            isClash: clashResult.isClash,
            report: report,
            winner: clashResult.winner,
            effects: clashResult.effects,
            damage: clashResult.damage,
            resolution: clashResult.resolution
        };
    }

    /**
     * Determine if skills clash and resolve the interaction based on comprehensive clash table
     * @param {Object} attackerSkill - Attacker's skill
     * @param {Object} defenderSkill - Defender's skill  
     * @param {number} attackerOutput - Attacker's skill output
     * @param {number} defenderOutput - Defender's skill output
     * @returns {Object} Clash resolution result
     */
    static determineClash(attackerSkill, defenderSkill, attackerOutput, defenderOutput) {
        const attackerType = this.getSkillTypeCategory(attackerSkill.type?.name);
        const defenderType = this.getSkillTypeCategory(defenderSkill.type?.name);
        
        // Check if both skills target each other (required for most clashes)
        const targetsEachOther = (attackerSkill.target === 'other' && defenderSkill.target === 'other');
        
        // Implement the comprehensive clash table
        return this.resolveClashByTable(
            attackerType, 
            defenderType, 
            attackerOutput, 
            defenderOutput, 
            targetsEachOther,
            attackerSkill,
            defenderSkill
        );
    }

    /**
     * Resolve clash based on the comprehensive clash table
     * @param {string} typeA - First skill type
     * @param {string} typeB - Second skill type
     * @param {number} outputA - First skill output
     * @param {number} outputB - Second skill output
     * @param {boolean} targetsEachOther - Whether skills target each other
     * @param {Object} skillA - First skill object
     * @param {Object} skillB - Second skill object
     * @returns {Object} Clash resolution result
     */
    static resolveClashByTable(typeA, typeB, outputA, outputB, targetsEachOther, skillA, skillB) {
        // Attack vs Attack - Both take damage equal to opponent's final output
        if (typeA === 'Attack' && typeB === 'Attack') {
            if (targetsEachOther) {
                return {
                    isClash: true,
                    winner: outputA > outputB ? 'attacker' : outputB > outputA ? 'defender' : 'tie',
                    effects: ['mutual_damage', 'both_take_full_output'],
                    damage: { attacker: outputB, defender: outputA },
                    resolution: `Both attackers take damage: Attacker takes ${outputB}, Defender takes ${outputA}`
                };
            }
        }

        // Attack vs Defence - Defender absorbs, subtract from output
        if (typeA === 'Attack' && typeB === 'Defence') {
            if (targetsEachOther) {
                const remainingDamage = Math.max(0, outputA - outputB);
                return {
                    isClash: true,
                    winner: remainingDamage > 0 ? 'attacker' : 'defender',
                    effects: ['damage_absorbed', `absorbed_${outputB}_damage`],
                    damage: { attacker: 0, defender: remainingDamage },
                    resolution: `Defence absorbs ${Math.min(outputA, outputB)} damage. Remaining damage: ${remainingDamage}`
                };
            }
        }

        // Attack vs Counter - If Counter > Attack → attacker takes counter's output
        if (typeA === 'Attack' && typeB === 'Counter') {
            if (targetsEachOther) {
                if (outputB > outputA) {
                    return {
                        isClash: true,
                        winner: 'defender',
                        effects: ['counter_successful', 'attacker_takes_counter_damage'],
                        damage: { attacker: outputB, defender: 0 },
                        resolution: `Counter successful! Attacker takes ${outputB} damage from counter`
                    };
                } else {
                    return {
                        isClash: true,
                        winner: 'attacker',
                        effects: ['counter_failed', 'defender_takes_attack_damage'],
                        damage: { attacker: 0, defender: outputA },
                        resolution: `Counter failed! Defender takes ${outputA} damage from attack`
                    };
                }
            }
        }

        // Attack vs Buff/Heal - Conditional: Buff/Heal executes; Attacker deals damage
        if (typeA === 'Attack' && (typeB === 'Buff' || typeB === 'Heal')) {
            return {
                isClash: false, // Conditional clash
                winner: null,
                effects: ['buff_heal_executed', 'attack_executed', 'both_resolve'],
                damage: { attacker: 0, defender: outputA },
                resolution: `Both resolve: ${typeB} effect applied, then ${outputA} damage dealt`
            };
        }

        // Attack vs Debuff - Conditional: Debuff applies; Attacker deals damage
        if (typeA === 'Attack' && typeB === 'Debuff') {
            return {
                isClash: false, // Conditional clash
                winner: null,
                effects: ['debuff_applied', 'attack_executed', 'both_resolve'],
                damage: { attacker: 0, defender: outputA },
                resolution: `Both resolve: Debuff applied, then ${outputA} damage dealt`
            };
        }

        // Attack vs Crafting - Edge case: Crafting halted; output negated if taking full damage
        if (typeA === 'Attack' && typeB === 'Crafting') {
            return {
                isClash: true,
                winner: 'attacker',
                effects: ['crafting_interrupted', 'crafting_output_negated'],
                damage: { attacker: 0, defender: outputA },
                resolution: `Crafting interrupted by attack! Crafting output negated, ${outputA} damage dealt`
            };
        }

        // Defence vs Buff/Heal - No clash: Both resolve independently
        if (typeA === 'Defence' && (typeB === 'Buff' || typeB === 'Heal')) {
            return {
                isClash: false,
                winner: null,
                effects: ['both_resolve_independently'],
                damage: { attacker: 0, defender: 0 },
                resolution: `Both resolve independently: Defence ready, ${typeB} effect applied`
            };
        }

        // Buff vs Debuff - No clash: Both resolve
        if ((typeA === 'Buff' || typeA === 'Heal') && typeB === 'Debuff') {
            return {
                isClash: false,
                winner: null,
                effects: ['both_resolve', 'buff_debuff_interaction'],
                damage: { attacker: 0, defender: 0 },
                resolution: `Both resolve: ${typeA} and Debuff effects both apply`
            };
        }

        // Buff/Heal vs Buff/Heal - No clash: Both resolve independently
        if ((typeA === 'Buff' || typeA === 'Heal') && (typeB === 'Buff' || typeB === 'Heal')) {
            return {
                isClash: false,
                winner: null,
                effects: ['both_resolve_independently'],
                damage: { attacker: 0, defender: 0 },
                resolution: `Both resolve independently: ${typeA} and ${typeB} effects both apply`
            };
        }

        // Handle reverse cases (when defender is the "attacker" in the table)
        if (typeB === 'Attack' && typeA === 'Defence') {
            if (targetsEachOther) {
                const remainingDamage = Math.max(0, outputB - outputA);
                return {
                    isClash: true,
                    winner: remainingDamage > 0 ? 'defender' : 'attacker',
                    effects: ['damage_absorbed', `absorbed_${outputA}_damage`],
                    damage: { attacker: remainingDamage, defender: 0 },
                    resolution: `Defence absorbs ${Math.min(outputB, outputA)} damage. Remaining damage: ${remainingDamage}`
                };
            }
        }

        if (typeB === 'Attack' && typeA === 'Counter') {
            if (targetsEachOther) {
                if (outputA > outputB) {
                    return {
                        isClash: true,
                        winner: 'attacker',
                        effects: ['counter_successful', 'defender_takes_counter_damage'],
                        damage: { attacker: 0, defender: outputA },
                        resolution: `Counter successful! Defender takes ${outputA} damage from counter`
                    };
                } else {
                    return {
                        isClash: true,
                        winner: 'defender',
                        effects: ['counter_failed', 'attacker_takes_attack_damage'],
                        damage: { attacker: outputB, defender: 0 },
                        resolution: `Counter failed! Attacker takes ${outputB} damage from attack`
                    };
                }
            }
        }

        if (typeB === 'Attack' && (typeA === 'Buff' || typeA === 'Heal')) {
            return {
                isClash: false, // Conditional clash
                winner: null,
                effects: ['buff_heal_executed', 'attack_executed', 'both_resolve'],
                damage: { attacker: outputB, defender: 0 },
                resolution: `Both resolve: ${typeA} effect applied, then ${outputB} damage dealt`
            };
        }

        if (typeB === 'Attack' && typeA === 'Debuff') {
            return {
                isClash: false, // Conditional clash
                winner: null,
                effects: ['debuff_applied', 'attack_executed', 'both_resolve'],
                damage: { attacker: outputB, defender: 0 },
                resolution: `Both resolve: Debuff applied, then ${outputB} damage dealt`
            };
        }

        if (typeB === 'Attack' && typeA === 'Crafting') {
            return {
                isClash: true,
                winner: 'defender',
                effects: ['crafting_interrupted', 'crafting_output_negated'],
                damage: { attacker: outputB, defender: 0 },
                resolution: `Crafting interrupted by attack! Crafting output negated, ${outputB} damage dealt`
            };
        }

        // Handle Debuff vs Buff (reverse case)
        if (typeA === 'Debuff' && (typeB === 'Buff' || typeB === 'Heal')) {
            return {
                isClash: false,
                winner: null,
                effects: ['both_resolve', 'buff_debuff_interaction'],
                damage: { attacker: 0, defender: 0 },
                resolution: `Both resolve: Debuff and ${typeB} effects both apply`
            };
        }

        // Default case - no clash
        return {
            isClash: false,
            winner: null,
            effects: ['no_interaction'],
            damage: { attacker: 0, defender: 0 },
            resolution: `No clash: Both skills resolve independently`
        };
    }

    /**
     * Categorize skill types into broad categories
     * @param {string} skillTypeName - The name of the skill type
     * @returns {string} The category
     */
    static getSkillTypeCategory(skillTypeName) {
        if (!skillTypeName) return 'Unknown';
        
        const name = skillTypeName.toLowerCase();
        
        if (name.includes('attack') || name.includes('offensive') || name.includes('damage')) {
            return 'Attack';
        }
        if (name.includes('defence') || name.includes('defensive') || name.includes('block') || name.includes('shield')) {
            return 'Defence';
        }
        if (name.includes('counter') || name.includes('retaliate')) {
            return 'Counter';
        }
        if (name.includes('debuff') || name.includes('curse') || name.includes('weaken')) {
            return 'Debuff';
        }
        if (name.includes('buff') || name.includes('enhance') || name.includes('boost')) {
            return 'Buff';
        }
        if (name.includes('heal') || name.includes('restore') || name.includes('recovery')) {
            return 'Heal';
        }
        if (name.includes('craft') || name.includes('create') || name.includes('build')) {
            return 'Crafting';
        }
        if (name.includes('passive')) {
            return 'Passive';
        }
        
        // Default to Attack if uncertain
        return 'Attack';
    }

    /**
     * Convert roll multiplier back to d20 roll for reporting
     * @param {number} multiplier - The roll multiplier (0.6, 1.0, or 1.4)
     * @returns {number} Estimated d20 roll
     */
    static getRollFromMultiplier(multiplier) {
        if (multiplier <= 0.6) return Math.floor(Math.random() * 3) + 1; // 1-3
        if (multiplier >= 1.4) return Math.floor(Math.random() * 3) + 18; // 18-20
        return Math.floor(Math.random() * 14) + 4; // 4-17
    }
} 