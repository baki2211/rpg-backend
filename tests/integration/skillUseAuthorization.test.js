import { describe, it, expect, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeSkill, giveSkill } from './support/factories.js';

// Every d20 is 11 (Standard, x1.0)
vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));

const app = createApp();

// Security item 11: /skills/use used to accept any characterId and any skillId.
describe('POST /api/skills/use by someone who may not use the skill', () => {
  it('using a skill with another player\'s character is not found and changes nothing', async () => {
    const intruder = await makeUser();
    const victim = await makeCharacter({ user: await makeUser(), stats: { hp: 50, aether: 30 } });
    const drain = await makeSkill({ target: 'self', aetherCost: 10 });
    await giveSkill(victim, drain);
    const client = await logIn(app, intruder);

    const response = await client.post('/api/skills/use', { characterId: victim.id, skillId: drain.id });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Character or skill not found' });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [victim.id]);
    expect(stats).toEqual({ hp: 50, aether: 30 });
    expect(await query(`SELECT uses FROM character_skills`)).toEqual([{ uses: 0 }]);
  });

  it('using a skill the character has not learned is forbidden and changes nothing', async () => {
    const player = await makeUser();
    const character = await makeCharacter({ user: player, stats: { hp: 50, aether: 30 } });
    const unlearned = await makeSkill({ target: 'self', aetherCost: 10 });
    const client = await logIn(app, player);

    const response = await client.post('/api/skills/use', { characterId: character.id, skillId: unlearned.id });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Character does not have this skill' });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [character.id]);
    expect(stats).toEqual({ hp: 50, aether: 30 });
    expect(await query(`SELECT * FROM character_skill_branches`)).toEqual([]);
  });
});
