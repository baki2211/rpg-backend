// Clash table: what happens when two skills meet, by skill type category and final output.

const SKILL_TYPE_CATEGORIES = Object.freeze({
    Attack: 'Attack',
    Defence: 'Defence',
    Defense: 'Defence', // both spellings
    Counter: 'Counter',
    Buff: 'Buff',
    Debuff: 'Debuff',
    Healing: 'Heal',
    Crafting: 'Crafting',
    Passive: 'Passive',
});

/**
 * Clash category of a skill type name ('Healing' is 'Heal', 'Defense' is 'Defence').
 * @param {string|null|undefined} skillTypeName - skill_types.name
 * @returns {string} 'Attack' | 'Defence' | 'Counter' | 'Buff' | 'Debuff' | 'Heal' | 'Crafting' | 'Passive' | 'Unknown'
 */
export function skillTypeCategory(skillTypeName) {
    return Object.hasOwn(SKILL_TYPE_CATEGORIES, skillTypeName ?? '') ? SKILL_TYPE_CATEGORIES[skillTypeName] : 'Unknown';
}

/**
 * Resolve two skills that meet, side A being the attacker and side B the defender.
 * @param {string} typeA - Category of A (see skillTypeCategory)
 * @param {string} typeB - Category of B
 * @param {number} outputA - Final output of A
 * @param {number} outputB - Final output of B
 * @param {boolean} targetsEachOther - Both skills target 'other' (only Attack vs Attack needs it)
 * @returns {{ isClash: boolean, winner: 'attacker'|'defender'|'tie'|null, effects: string[],
 *             damage: { attacker: number, defender: number }, resolution: string }}
 */
export function resolveClashByTable(typeA, typeB, outputA, outputB, targetsEachOther) {
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
        const remainingDamage = Math.max(0, outputA - outputB);
        return {
            isClash: true,
            winner: remainingDamage > 0 ? 'attacker' : 'defender',
            effects: ['damage_absorbed', `absorbed_${Math.min(outputA, outputB)}_damage`],
            damage: { attacker: 0, defender: remainingDamage },
            resolution: `Defence absorbs ${Math.min(outputA, outputB)} damage. Remaining damage: ${remainingDamage}`
        };
    }

    // Attack vs Counter - If Counter > Attack → attacker takes counter's output
    if (typeA === 'Attack' && typeB === 'Counter') {
        if (outputB > outputA) {
            return {
                isClash: true,
                winner: 'defender',
                effects: ['counter_successful', 'attacker_takes_counter_damage'],
                damage: { attacker: outputB, defender: 0 },
                resolution: `Counter successful! Attacker takes ${outputB} damage from counter`
            };
        }
        return {
            isClash: true,
            winner: 'attacker',
            effects: ['counter_failed', 'defender_takes_attack_damage'],
            damage: { attacker: 0, defender: outputA },
            resolution: `Counter failed! Defender takes ${outputA} damage from attack`
        };
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

    // Reverse cases (the defender is the "attacker" in the table)
    if (typeB === 'Attack' && typeA === 'Defence') {
        const remainingDamage = Math.max(0, outputB - outputA);
        return {
            isClash: true,
            winner: remainingDamage > 0 ? 'defender' : 'attacker',
            effects: ['damage_absorbed', `absorbed_${Math.min(outputB, outputA)}_damage`],
            damage: { attacker: remainingDamage, defender: 0 },
            resolution: `Defence absorbs ${Math.min(outputB, outputA)} damage. Remaining damage: ${remainingDamage}`
        };
    }

    if (typeB === 'Attack' && typeA === 'Counter') {
        if (outputA > outputB) {
            return {
                isClash: true,
                winner: 'attacker',
                effects: ['counter_successful', 'defender_takes_counter_damage'],
                damage: { attacker: 0, defender: outputA },
                resolution: `Counter successful! Defender takes ${outputA} damage from counter`
            };
        }
        return {
            isClash: true,
            winner: 'defender',
            effects: ['counter_failed', 'attacker_takes_attack_damage'],
            damage: { attacker: outputB, defender: 0 },
            resolution: `Counter failed! Attacker takes ${outputB} damage from attack`
        };
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

    // Debuff vs Buff (reverse case)
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
 * Resolve two skills by the clash table, from the skills themselves.
 * @param {{ type?: { name?: string }, target: string }} attackerSkill
 * @param {{ type?: { name?: string }, target: string }} defenderSkill
 * @param {number} attackerOutput
 * @param {number} defenderOutput
 * @returns {ReturnType<typeof resolveClashByTable>}
 */
export function determineClash(attackerSkill, defenderSkill, attackerOutput, defenderOutput) {
    return resolveClashByTable(
        skillTypeCategory(attackerSkill.type?.name),
        skillTypeCategory(defenderSkill.type?.name),
        attackerOutput,
        defenderOutput,
        attackerSkill.target === 'other' && defenderSkill.target === 'other'
    );
}

/**
 * Outcome of a PvP encounter: the clash plus a report line per side with the real d20 roll.
 * @param {Object} attacker - `{ character: { name }, skill: { name, target, type?: { name } }, output: number, roll: number }`
 * @param {Object} defender - same shape as `attacker`
 * @returns {{ isClash: boolean, report: Object[], winner: string|null, effects: string[],
 *             damage: { attacker: number, defender: number }, resolution: string }}
 */
export function resolveEncounter(attacker, defender) {
    const clash = determineClash(attacker.skill, defender.skill, attacker.output, defender.output);
    // Both target names follow the defender's skill target (kept as it was before the extraction)
    const selfTargeted = defender.skill.target === 'self';

    return {
        isClash: clash.isClash,
        report: [
            reportLine(attacker, selfTargeted ? attacker.character.name : defender.character.name),
            reportLine(defender, selfTargeted ? defender.character.name : attacker.character.name),
        ],
        winner: clash.winner,
        effects: clash.effects,
        damage: clash.damage,
        resolution: clash.resolution,
    };
}

function reportLine({ character, skill, output, roll }, target) {
    return {
        actor: character.name,
        target,
        roll,
        skillType: skill.type?.name || 'Unknown',
        skillName: skill.name,
        output,
    };
}
