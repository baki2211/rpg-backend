import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB and service dependencies before importing SkillEngine
vi.mock('../../src/data-source.js', () => ({
  AppDataSource: { getRepository: vi.fn(() => ({})) },
}));

vi.mock('../../src/services/StatDefinitionService.js', () => ({
  StatDefinitionService: class {},
}));

import { SkillEngine } from '../../src/services/SkillEngine.js';

describe('SkillEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new SkillEngine({}, {});
  });

  describe('calculateSkillRankMultiplier', () => {
    const cases = [
      [0,   1.0],
      [19,  1.0],
      [20,  1.3],
      [34,  1.3],
      [35,  1.7],
      [59,  1.7],
      [60,  2.2],
      [99,  2.2],
      [100, 2.8],
      [500, 2.8],
    ];

    it.each(cases)('uses=%i → %f', (uses, expected) => {
      expect(engine.calculateSkillRankMultiplier(uses)).toBe(expected);
    });
  });

  describe('calculateBranchRankMultiplier', () => {
    const cases = [
      [0,    1.0],
      [74,   1.0],
      [75,   1.05],
      [149,  1.05],
      [150,  1.1],
      [249,  1.1],
      [250,  1.15],
      [374,  1.15],
      [375,  1.2],
      [524,  1.2],
      [525,  1.25],
      [699,  1.25],
      [700,  1.3],
      [899,  1.3],
      [900,  1.35],
      [1124, 1.35],
      [1125, 1.4],
      [1374, 1.4],
      [1375, 1.5],
      [9999, 1.5],
    ];

    it.each(cases)('branchUses=%i → %f', (branchUses, expected) => {
      expect(engine.calculateBranchRankMultiplier(branchUses)).toBe(expected);
    });
  });

  describe('rollOutcome', () => {
    it('returns one of the three valid multipliers', () => {
      const valid = new Set([0.6, 1.0, 1.4]);
      const result = engine.rollOutcome();
      expect(valid.has(result)).toBe(true);
    });

    it('caches the result across repeated calls', () => {
      const first = engine.rollOutcome();
      const second = engine.rollOutcome();
      expect(first).toBe(second);
    });

    it('returns 0.6 on a poor roll (1–3)', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0); // floor(0 * 20) + 1 = 1
      const freshEngine = new SkillEngine({}, {});
      expect(freshEngine.rollOutcome()).toBe(0.6);
    });

    it('returns 1.0 on a standard roll (4–17)', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.15); // floor(0.15 * 20) + 1 = 4
      const freshEngine = new SkillEngine({}, {});
      expect(freshEngine.rollOutcome()).toBe(1.0);
    });

    it('returns 1.4 on a critical roll (18–20)', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.9); // floor(0.9 * 20) + 1 = 19
      const freshEngine = new SkillEngine({}, {});
      expect(freshEngine.rollOutcome()).toBe(1.4);
    });
  });

  describe('isCacheExpired', () => {
    it('returns false for a fresh timestamp', () => {
      expect(engine.isCacheExpired(Date.now())).toBe(false);
    });

    it('returns true for a timestamp older than 30s', () => {
      expect(engine.isCacheExpired(Date.now() - 31000)).toBe(true);
    });
  });
});
