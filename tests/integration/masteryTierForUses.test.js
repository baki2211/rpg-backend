import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { logIn } from './support/auth.js';
import { makeUser, makeMasteryTier } from './support/factories.js';

const app = createApp();

describe('GET /api/mastery-tiers/uses/:uses', () => {
  // The answer follows the same skill rank ladder as the skill formulas (staticDataCache.getSkillRules).
  it('returns the active mastery tier the skill formulas use for that many uses', async () => {
    await makeMasteryTier({ tier: 1, usesRequired: 0, multiplier: 1.0 });
    const tier2 = await makeMasteryTier({ tier: 2, usesRequired: 10, multiplier: 1.5 });
    await makeMasteryTier({ tier: 3, usesRequired: 25, multiplier: 2.0 });
    const client = await logIn(app, await makeUser());

    const response = await client.get('/api/mastery-tiers/uses/24');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: tier2.id, tier: 2, tierName: 'Tier 2', usesRequired: 10, multiplier: 1.5, isActive: true });
  });

  it('without mastery tier rows, returns the default tier the skill formulas fall back to', async () => {
    const client = await logIn(app, await makeUser());

    const response = await client.get('/api/mastery-tiers/uses/20');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      tier: 2, tierName: 'Tier II', description: 'Apprentice - Growing skill', usesRequired: 20, multiplier: 1.3, isActive: true,
    });
  });
});
