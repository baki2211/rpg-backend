import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import {
  makeUser, makeCharacter, makeSkillType, makeSkill, giveSkill, makeMasteryTier, makeCombatConstant,
} from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

describe('POST /api/skills/use without a target, with the skill tables edited in the database', () => {
  // F6: the mastery tiers and the MASTERY_TIER_n / OUTCOME_*_MULT constants used to have no effect on play.
  it('the output and the new skill rank follow the database rows instead of the code defaults', async () => {
    const owner = await makeUser();
    const character = await makeCharacter({ user: owner, stats: { hp: 50, aether: 30 } });
    const skill = await makeSkill({ type: await makeSkillType('Buff'), basePower: 10, target: 'self' });
    await giveSkill(character, skill, { uses: 10 });
    await makeMasteryTier({ tier: 1, usesRequired: 0, multiplier: 1.0 });
    await makeMasteryTier({ tier: 2, usesRequired: 10, multiplier: 1.5 });
    await makeCombatConstant({ constantKey: 'MASTERY_TIER_1', value: 1.1, category: 'mastery_system' });
    await makeCombatConstant({ constantKey: 'OUTCOME_STANDARD_MULT', value: 1.2 });
    const client = await logIn(app, owner);

    const response = await client.post('/api/skills/use', { characterId: character.id, skillId: skill.id });

    // 10 * (skill rank 2 at 10 uses: 1.5 + branch rank I: 1.1) * Standard 1.2 = 31.2, floored.
    // With the code defaults it would be 10 * (1.0 + 1.0) * 1.0 = 20.
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Skill used successfully', output: 31, remainingAether: 30 });
    const ranks = await query(`SELECT uses, rank FROM character_skills WHERE "characterId" = $1`, [character.id]);
    expect(ranks).toEqual([{ uses: 11, rank: 2 }]);
  });
});
