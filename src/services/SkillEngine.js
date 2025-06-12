import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';
import { CharacterSkill } from '../models/characterSkillModel.js';
import { CharacterSkillBranch } from '../models/characterSkillBranchModel.js';
import { AppDataSource } from '../data-source.js';
import { StatDefinitionService } from './StatDefinitionService.js';

export class ClashResult {
    constructor(winner, damage, effects) {
        this.winner = winner; // 'attacker' or 'defender'
        this.damage = damage;
        this.effects = effects;
    }
}

export class SkillEngine {
    constructor(character, skill) {
        this.character = character;
        this.skill = skill;
        this.statDefinitionService = new StatDefinitionService();
    }

    /**
     * Calculate skill rank multiplier based on uses
     * @param {number} uses - Number of times the skill has been used
     * @returns {number} The skill rank multiplier
     */
    calculateSkillRankMultiplier(uses) {
        if (uses < 20) return 1.0;        // Rank I
        if (uses < 35) return 1.3;        // Rank II
        if (uses < 60) return 1.7;        // Rank III
        if (uses < 100) return 2.2;       // Rank IV
        return 2.8;                       // Rank V
    }

    /**
     * Calculate branch rank multiplier based on total branch uses
     * @param {number} branchUses - Total uses for the branch
     * @returns {number} The branch rank multiplier
     */
    calculateBranchRankMultiplier(branchUses) {
        if (branchUses < 75) return 1.0;     // Rank I
        if (branchUses < 150) return 1.05;   // Rank II
        if (branchUses < 250) return 1.1;    // Rank III
        if (branchUses < 375) return 1.15;   // Rank IV
        if (branchUses < 525) return 1.2;    // Rank V
        if (branchUses < 700) return 1.25;   // Rank VI
        if (branchUses < 900) return 1.3;    // Rank VII
        if (branchUses < 1125) return 1.35;  // Rank VIII
        if (branchUses < 1375) return 1.4;   // Rank IX
        return 1.5;                          // Rank X
    }

    /**
     * Get skill uses for this character and skill
     * @returns {Promise<number>} Number of uses
     */
    async getSkillUses() {
        const characterSkillRepo = AppDataSource.getRepository(CharacterSkill);
        const characterSkill = await characterSkillRepo.findOne({
            where: { 
                characterId: this.character.id, 
                skillId: this.skill.id 
            }
        });
        return characterSkill?.uses || 0;
    }

    /**
     * Get branch uses for this character and skill's branch
     * @returns {Promise<number>} Number of branch uses
     */
    async getBranchUses() {
        const characterSkillBranchRepo = AppDataSource.getRepository(CharacterSkillBranch);
        const characterSkillBranch = await characterSkillBranchRepo.findOne({
            where: { 
                characterId: this.character.id, 
                branchId: this.skill.branchId 
            }
        });
        return characterSkillBranch?.uses || 0;
    }

    /**
     * Calculate the base impact of the skill based on character stats and skill properties
     * @returns {Promise<number>} The calculated impact value
     */
    async calculateImpact() {
        let impact = this.skill.basePower;

        // Apply scaling from character stats with weighted formula
        if (this.skill.scalingStats && this.skill.scalingStats.length > 0) {
            // Get all primary stat definitions to validate scaling stats
            const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
            const validStatNames = primaryStats.map(stat => stat.internalName);
            
            // Filter scaling stats to only include valid ones
            const validScalingStats = this.skill.scalingStats.filter(stat => validStatNames.includes(stat));
            
            if (validScalingStats.length > 0) {
                const statValues = validScalingStats.map(stat => ({
                    stat: stat,
                    value: this.character.stats[stat] || 0
                }));

                // Sort stats by value in descending order for weight assignment
                statValues.sort((a, b) => b.value - a.value);

                // Define weights based on number of stats
                let weights;
                switch (statValues.length) {
                    case 1:
                        weights = [1.0]; // 100%
                        break;
                    case 2:
                        weights = [0.7, 0.3]; // 70%, 30%
                        break;
                    case 3:
                    default:
                        weights = [0.6, 0.25, 0.15]; // 60%, 25%, 15%
                        break;
                }

                // Apply weighted stat contributions
                for (let i = 0; i < Math.min(statValues.length, weights.length); i++) {
                    const statContribution = statValues[i].value * weights[i];
                    impact += Math.floor(statContribution);
                }
            }
        }

        return impact;
    }

    /**
     * Roll for the outcome of the skill usage using d20 system
     * @returns {number} A multiplier based on the roll outcome (0.6, 1.0, or 1.4)
     */
    rollOutcome() {
        // Roll a d20 (1-20)
        const roll = Math.floor(Math.random() * 20) + 1;
        
        // Determine outcome based on roll ranges
        if (roll >= 1 && roll <= 3) {
            // Poor Success (15% chance)
            return 0.6;
        } else if (roll >= 4 && roll <= 17) {
            // Standard Success (70% chance)
            return 1.0;
        } else if (roll >= 18 && roll <= 20) {
            // Critical Success (15% chance)
            return 1.4;
        }
        
        // Fallback (should never reach here)
        return 1.0;
    }

    /**
     * Compute the final output of the skill
     * @returns {Promise<number>} The final calculated output value
     */
    async computeFinalOutput() {
        const impact = await this.calculateImpact();
        const outcomeMultiplier = this.rollOutcome();
        
        // Get skill and branch uses
        const skillUses = await this.getSkillUses();
        const branchUses = await this.getBranchUses();
        
        // Calculate multipliers
        const skillRankMultiplier = this.calculateSkillRankMultiplier(skillUses);
        const branchRankMultiplier = this.calculateBranchRankMultiplier(branchUses);
        
        // Apply the formula: Final Output = IMP × (RankMultiplier + BranchMultiplier) × OutcomeMultiplier
        const finalOutput = impact * (skillRankMultiplier + branchRankMultiplier) * outcomeMultiplier;
        
        return Math.floor(finalOutput);
    }

    /**
     * Resolve a clash between two skills
     * @param {Character} target - The target character
     * @param {Skill} targetSkill - The skill used by the target
     * @returns {Promise<ClashResult>} The result of the clash
     */
    async resolveClash(target, targetSkill) {
        const attackerOutput = await this.computeFinalOutput();
        const defenderOutput = await new SkillEngine(target, targetSkill).computeFinalOutput();

        // Determine winner and calculate damage
        let winner, damage;
        if (attackerOutput > defenderOutput) {
            winner = 'attacker';
            damage = attackerOutput - defenderOutput;
        } else if (defenderOutput > attackerOutput) {
            winner = 'defender';
            damage = defenderOutput - attackerOutput;
        } else {
            // In case of a tie, both take minimal damage
            winner = 'tie';
            damage = Math.floor(attackerOutput * 0.1);
        }

        // Generate effects based on the clash
        const effects = this.generateClashEffects(winner, damage);

        return new ClashResult(winner, damage, effects);
    }

    /**
     * Apply the cost of using the skill to the character
     * @param {Skill} skill - The skill being used
     */
    async applyCost(skill) {
        // Deduct aether cost from character stats
        if (!this.character.stats.aether || this.character.stats.aether < skill.aetherCost) {
            throw new Error(`Insufficient aether to use this skill. Required: ${skill.aetherCost}, Available: ${this.character.stats.aether || 0}`);
        }
        
        this.character.stats.aether -= skill.aetherCost;

        // Apply any additional costs or effects
        if (skill.requiredStats) {
            // Get all primary stat definitions to validate required stats
            const primaryStats = await this.statDefinitionService.getAllStatDefinitions('primary_stat', true);
            const validStatNames = primaryStats.map(stat => stat.internalName);
            
            // Handle any stat requirements or costs
            Object.entries(skill.requiredStats).forEach(([stat, value]) => {
                if (validStatNames.includes(stat)) {
                    if (!this.character.stats[stat] || this.character.stats[stat] < value) {
                        throw new Error(`Insufficient ${stat} to use this skill. Required: ${value}, Available: ${this.character.stats[stat] || 0}`);
                    }
                }
            });
        }

        // Note: Character saving should be handled by the calling service
        // This method just modifies the character object in memory
        return true;
    }

    /**
     * Generate effects for a clash
     * @private
     * @param {string} winner - The winner of the clash
     * @param {number} damage - The damage dealt
     * @returns {Object} The effects of the clash
     */
    generateClashEffects(winner, damage) {
        const effects = {
            damage: damage,
            status: winner === 'tie' ? 'stalemate' : 'victory',
            critical: damage > this.skill.basePower * 1.5
        };

        // Add additional effects based on skill types
        if (this.skill.typeId === 1) { // Assuming 1 is for offensive skills
            effects.stagger = damage > this.skill.basePower;
        } else if (this.skill.typeId === 2) { // Assuming 2 is for defensive skills
            effects.block = damage < this.skill.basePower * 0.5;
        }

        return effects;
    }
} 