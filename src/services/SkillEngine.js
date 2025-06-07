import { Character } from '../models/characterModel.js';
import { Skill } from '../models/skillModel.js';

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
    }

    /**
     * Calculate the base impact of the skill based on character stats and skill properties
     * @returns {number} The calculated impact value
     */
    calculateImpact() {
        let impact = this.skill.basePower;

        // Apply scaling from character stats
        if (this.skill.scalingStats && this.skill.scalingStats.length > 0) {
            this.skill.scalingStats.forEach(stat => {
                const statValue = this.character.stats[stat] || 0;
                // Each stat contributes 20% of its value to the impact
                impact += Math.floor(statValue * 0.2);
            });
        }

        return impact;
    }

    /**
     * Roll for the outcome of the skill usage
     * @returns {number} A random number between 0.8 and 1.2 representing the roll outcome
     */
    rollOutcome() {
        // Generate a random number between 0.8 and 1.2
        return 0.8 + Math.random() * 0.4;
    }

    /**
     * Compute the final output of the skill
     * @returns {number} The final calculated output value
     */
    computeFinalOutput() {
        const impact = this.calculateImpact();
        const roll = this.rollOutcome();
        return Math.floor(impact * roll);
    }

    /**
     * Resolve a clash between two skills
     * @param {Character} target - The target character
     * @param {Skill} targetSkill - The skill used by the target
     * @returns {ClashResult} The result of the clash
     */
    resolveClash(target, targetSkill) {
        const attackerOutput = this.computeFinalOutput();
        const defenderOutput = new SkillEngine(target, targetSkill).computeFinalOutput();

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
    applyCost(skill) {
        // Deduct aether cost
        this.character.aether -= skill.aetherCost;

        // Apply any additional costs or effects
        if (skill.requiredStats) {
            // Handle any stat requirements or costs
            Object.entries(skill.requiredStats).forEach(([stat, value]) => {
                if (this.character.stats[stat] < value) {
                    throw new Error(`Insufficient ${stat} to use this skill`);
                }
            });
        }

        // Save character changes
        return this.character.save();
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
            critical: damage > this.calculateImpact() * 1.5
        };

        // Add additional effects based on skill types
        if (this.skill.typeId === 1) { // Assuming 1 is for offensive skills
            effects.stagger = damage > this.calculateImpact();
        } else if (this.skill.typeId === 2) { // Assuming 2 is for defensive skills
            effects.block = damage < this.calculateImpact() * 0.5;
        }

        return effects;
    }
} 