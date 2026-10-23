import { SkillEngine } from './SkillEngine.js';
import { resolveEncounter } from '../domain/combat/clashTable.js';

export class PvPResolutionService {

    /**
     * Resolve a PvP encounter between two characters using skills (clash table in src/domain/combat/clashTable.js).
     * Does not record skill usage: the caller owns that write, inside its own transaction.
     * @param {Object} attacker - The attacking character
     * @param {Object} attackerSkill - The skill used by the attacker
     * @param {Object} defender - The defending character
     * @param {Object} defenderSkill - The skill used by the defender
     * @param {{ attacker: number, defender: number }} rolls - Each side's d20 (rollD20() in src/utils/dice.js)
     * @returns {Promise<Object>} Combat resolution result
     */
    static async resolvePvPEncounter(attacker, attackerSkill, defender, defenderSkill, rolls) {
        const [attackerOutput, defenderOutput] = await Promise.all([
            new SkillEngine(attacker, attackerSkill).computeFinalOutput(rolls.attacker),
            new SkillEngine(defender, defenderSkill).computeFinalOutput(rolls.defender)
        ]);

        return resolveEncounter(
            { character: attacker, skill: attackerSkill, output: attackerOutput.finalOutput, roll: attackerOutput.roll },
            { character: defender, skill: defenderSkill, output: defenderOutput.finalOutput, roll: defenderOutput.roll }
        );
    }
}
