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
            damage: clashResult.damage
        };
    }

    /**
     * Determine if skills clash and resolve the interaction
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
        
        // Determine clash based on skill type combinations
        switch (attackerType) {
            case 'Attack':
                return this.resolveAttackClash(defenderType, attackerOutput, defenderOutput, targetsEachOther);
            
            case 'Defence':
                return this.resolveDefenceClash(defenderType, attackerOutput, defenderOutput);
            
            case 'Buff':
            case 'Heal':
                return this.resolveBuffHealClash(defenderType, attackerOutput, defenderOutput);
            
            case 'Debuff':
                return this.resolveDebuffClash(defenderType, attackerOutput, defenderOutput);
            
            case 'Counter':
                return this.resolveCounterClash(defenderType, attackerOutput, defenderOutput, targetsEachOther);
            
            case 'Crafting':
                return this.resolveCraftingClash(defenderType, attackerOutput, defenderOutput);
            
            default:
                return { isClash: false, winner: null, effects: [], damage: 0 };
        }
    }

    /**
     * Resolve clashes involving Attack skills
     */
    static resolveAttackClash(defenderType, attackerOutput, defenderOutput, targetsEachOther) {
        switch (defenderType) {
            case 'Attack':
                if (targetsEachOther) {
                    return {
                        isClash: true,
                        winner: attackerOutput > defenderOutput ? 'attacker' : 
                               defenderOutput > attackerOutput ? 'defender' : 'tie',
                        effects: ['mutual_damage'],
                        damage: { attacker: defenderOutput, defender: attackerOutput }
                    };
                }
                break;
                
            case 'Defence':
                if (targetsEachOther) {
                    const remainingDamage = Math.max(0, attackerOutput - defenderOutput);
                    return {
                        isClash: true,
                        winner: remainingDamage > 0 ? 'attacker' : 'defender',
                        effects: ['damage_absorbed'],
                        damage: { attacker: 0, defender: remainingDamage }
                    };
                }
                break;
                
            case 'Counter':
                if (targetsEachOther && defenderOutput > attackerOutput) {
                    return {
                        isClash: true,
                        winner: 'defender',
                        effects: ['counter_attack'],
                        damage: { attacker: defenderOutput, defender: 0 }
                    };
                } else if (targetsEachOther) {
                    return {
                        isClash: true,
                        winner: 'attacker',
                        effects: ['counter_failed'],
                        damage: { attacker: 0, defender: attackerOutput }
                    };
                }
                break;
                
            case 'Buff':
            case 'Heal':
                return {
                    isClash: false, // Conditional - both execute
                    winner: null,
                    effects: ['buff_heal_executed', 'attack_executed'],
                    damage: { attacker: 0, defender: attackerOutput }
                };
                
            case 'Debuff':
                return {
                    isClash: false, // Conditional - both execute
                    winner: null,
                    effects: ['debuff_applied', 'attack_executed'],
                    damage: { attacker: 0, defender: attackerOutput }
                };
                
            case 'Crafting':
                return {
                    isClash: true,
                    winner: 'attacker',
                    effects: ['crafting_interrupted'],
                    damage: { attacker: 0, defender: attackerOutput }
                };
        }
        
        return { isClash: false, winner: null, effects: [], damage: 0 };
    }

    /**
     * Resolve clashes involving Defence skills
     */
    static resolveDefenceClash(defenderType, attackerOutput, defenderOutput) {
        switch (defenderType) {
            case 'Buff':
            case 'Heal':
                return {
                    isClash: false,
                    winner: null,
                    effects: ['both_resolve_independently'],
                    damage: 0
                };
        }
        
        return { isClash: false, winner: null, effects: [], damage: 0 };
    }

    /**
     * Resolve clashes involving Buff/Heal skills
     */
    static resolveBuffHealClash(defenderType, attackerOutput, defenderOutput) {
        switch (defenderType) {
            case 'Debuff':
                return {
                    isClash: false,
                    winner: null,
                    effects: ['both_resolve'],
                    damage: 0
                };
                
            case 'Buff':
            case 'Heal':
                return {
                    isClash: false,
                    winner: null,
                    effects: ['both_resolve_independently'],
                    damage: 0
                };
        }
        
        return { isClash: false, winner: null, effects: [], damage: 0 };
    }

    /**
     * Resolve clashes involving Debuff skills
     */
    static resolveDebuffClash(defenderType, attackerOutput, defenderOutput) {
        return { isClash: false, winner: null, effects: [], damage: 0 };
    }

    /**
     * Resolve clashes involving Counter skills
     */
    static resolveCounterClash(defenderType, attackerOutput, defenderOutput, targetsEachOther) {
        // Counter skills are typically reactive, main logic handled in Attack resolution
        return { isClash: false, winner: null, effects: [], damage: 0 };
    }

    /**
     * Resolve clashes involving Crafting skills
     */
    static resolveCraftingClash(defenderType, attackerOutput, defenderOutput) {
        return { isClash: false, winner: null, effects: [], damage: 0 };
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
        if (name.includes('buff') || name.includes('enhance') || name.includes('boost')) {
            return 'Buff';
        }
        if (name.includes('heal') || name.includes('restore') || name.includes('recovery')) {
            return 'Heal';
        }
        if (name.includes('debuff') || name.includes('curse') || name.includes('weaken')) {
            return 'Debuff';
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