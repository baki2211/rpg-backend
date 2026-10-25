import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { query } from './support/database.js';
import { makeUser, makeCharacter, makeLocation, makeRace, makeRank, makeStatDefinition } from './support/factories.js';

const app = createApp();

// Two primary stats, a race with a control bonus (G4: read from controlBonus) and the seeded rank
// percentages (G9: added up rank by rank, applied once, by the formula).
async function makeRules() {
  await makeStatDefinition({ internalName: 'con', displayName: 'Control', category: 'primary_stat', sortOrder: 1 });
  await makeStatDefinition({ internalName: 'res', displayName: 'Resilience', category: 'primary_stat', sortOrder: 2 });
  await makeRank({ level: 1, requiredExperience: 0 });
  await makeRank({ level: 2, requiredExperience: 100, hpPercent: 4, aetherPercent: 3 });
  await makeRank({ level: 3, requiredExperience: 200, hpPercent: 4, aetherPercent: 3 });
  return makeRace({ healthBonus: 5, controlBonus: 2 });
}

describe('POST /api/admin/characters/recompute-stats', () => {
  it('rewrites the derived stats of the characters saved under the old rule and leaves the others alone', async () => {
    const race = await makeRules();
    const stale = await makeCharacter({ race, rank: 3, stats: { con: 4, res: 3, hp: 999, aether: 1 } });
    await makeCharacter({ rank: 1, stats: { reactions: 0, speed: 0, hp: 0, aether: 0 } });
    const admin = await makeUser({ role: 'admin' });
    const client = await logIn(app, admin);

    const response = await client.post('/api/admin/characters/recompute-stats');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, total: 2, updated: 1 });
    const [{ stats }] = await query(`SELECT stats FROM characters WHERE id = $1`, [stale.id]);
    // CON 6 (4 + race 2), RES 3; rank 3 = +8% hp, +6% aether
    // hp (3 × 2 + 6 × 3 + 5) × 1.08 = 31.32; aether √9 × 5 × 1.06 = 15.9; speed 9 / 3 = 3
    expect(stats).toEqual({ con: 4, res: 3, hp: 31, aether: 15, reactions: 0, speed: 3 });
  });
});

describe('level-up from a chat post', () => {
  it('recomputes hp and aether with the new rank instead of multiplying the stored values', async () => {
    const race = await makeRules();
    const player = await makeUser();
    const location = await makeLocation();
    const character = await makeCharacter({ user: player, race, rank: 1, experience: 99.5, stats: { con: 4, res: 3, hp: 10, aether: 5 } });
    const client = await logIn(app, player);

    const response = await client.post(`/api/chat/${location.id}`, { message: 'a'.repeat(801) });

    expect(response.status).toBe(201);
    const [{ rank, stats }] = await query(`SELECT rank, stats FROM characters WHERE id = $1`, [character.id]);
    expect(rank).toBe(2);
    // rank 2 = +4% hp, +3% aether: hp 29 × 1.04 = 30.16; aether 15 × 1.03 = 15.45
    expect(stats).toEqual({ con: 4, res: 3, hp: 30, aether: 15, reactions: 0, speed: 3 });
  });
});
