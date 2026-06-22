import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/data-source.js', () => ({
  AppDataSource: { getRepository: vi.fn(() => ({})) },
}));

vi.mock('../../src/services/EngineLogService.js', () => ({
  EngineLogService: class {},
}));

vi.mock('../../src/services/StatDefinitionService.js', () => ({
  StatDefinitionService: class {},
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../../src/services/SkillUsageService.js', () => ({
  SkillUsageService: { incrementSkillUsage: vi.fn() },
}));

import { CombatResolutionService } from '../../src/services/CombatResolutionService.js';

// id, characterId, targetId, raw skill type string (as stored in skillData.type)
function makeAction(id, characterId, targetId, type) {
  return { id, characterId, targetId, skillData: { type } };
}

describe('CombatResolutionService', () => {
  let service;

  beforeEach(() => {
    service = new CombatResolutionService();
  });

  // ─── actionsClash ────────────────────────────────────────────────────────────

  describe('actionsClash — Attack vs Attack', () => {
    it('clashes when both target each other', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(a, b)).toBe(true);
    });

    it('does not clash when attacking different targets', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 30, 40, 'Attack');
      expect(service.actionsClash(a, b)).toBe(false);
    });

    it('does not clash when only one targets the other', () => {
      const a = makeAction(1, 10, 20, 'Attack'); // 10 → 20
      const b = makeAction(2, 20, 30, 'Attack'); // 20 → 30 (not back at 10)
      expect(service.actionsClash(a, b)).toBe(false);
    });
  });

  describe('actionsClash — Attack vs Defence', () => {
    it('clashes when attacker targets the defending character (self-defence)', () => {
      // char 20 defends self; char 10 attacks char 20
      const atk = makeAction(1, 10, 20, 'Attack');
      const def = makeAction(2, 20, 20, 'Defence');
      expect(service.actionsClash(atk, def)).toBe(true);
    });

    it('clashes when attack and defence both target the same third party', () => {
      // char 30 defends char 20; char 10 also attacks char 20
      const atk = makeAction(1, 10, 20, 'Attack');
      const def = makeAction(2, 30, 20, 'Defence');
      expect(service.actionsClash(atk, def)).toBe(true);
    });

    it('clashes when defence targets the attacker', () => {
      // char 20 defends targeting char 10 (the attacker); attack goes elsewhere
      const atk = makeAction(1, 10, 99, 'Attack');
      const def = makeAction(2, 20, 10, 'Defence');
      expect(service.actionsClash(atk, def)).toBe(true);
    });

    it('clashes when the skill order is reversed (Defence, Attack)', () => {
      const def = makeAction(1, 20, 20, 'Defence');
      const atk = makeAction(2, 10, 20, 'Attack');
      expect(service.actionsClash(def, atk)).toBe(true);
    });

    it('does not clash when the defender is unrelated to the attack', () => {
      // char 10 attacks char 30; char 20 defends themselves — no connection
      const atk = makeAction(1, 10, 30, 'Attack');
      const def = makeAction(2, 20, 20, 'Defence');
      expect(service.actionsClash(atk, def)).toBe(false);
    });

    it('accepts American spelling "Defense" as equivalent to "Defence"', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const def = makeAction(2, 20, 20, 'Defense');
      expect(service.actionsClash(atk, def)).toBe(true);
    });
  });

  describe('actionsClash — Attack vs Counter', () => {
    it('always clashes (Attack first)', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const ctr = makeAction(2, 20, 10, 'Counter');
      expect(service.actionsClash(atk, ctr)).toBe(true);
    });

    it('always clashes (Counter first)', () => {
      const ctr = makeAction(1, 10, 20, 'Counter');
      const atk = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(ctr, atk)).toBe(true);
    });
  });

  describe('actionsClash — Attack vs Buff / Heal', () => {
    it('Attack vs Buff clashes', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const buff = makeAction(2, 20, 30, 'Buff');
      expect(service.actionsClash(atk, buff)).toBe(true);
    });

    it('Attack vs Healing clashes', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const heal = makeAction(2, 20, 30, 'Healing');
      expect(service.actionsClash(atk, heal)).toBe(true);
    });

    it('Buff vs Attack clashes (reversed)', () => {
      const buff = makeAction(1, 10, 20, 'Buff');
      const atk = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(buff, atk)).toBe(true);
    });

    it('Healing vs Attack clashes (reversed)', () => {
      const heal = makeAction(1, 10, 20, 'Healing');
      const atk = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(heal, atk)).toBe(true);
    });
  });

  describe('actionsClash — Attack vs Debuff', () => {
    it('clashes (Attack first)', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const deb = makeAction(2, 20, 30, 'Debuff');
      expect(service.actionsClash(atk, deb)).toBe(true);
    });

    it('clashes (Debuff first)', () => {
      const deb = makeAction(1, 10, 20, 'Debuff');
      const atk = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(deb, atk)).toBe(true);
    });
  });

  describe('actionsClash — Attack vs Crafting', () => {
    it('clashes (Attack first)', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const cft = makeAction(2, 20, 20, 'Crafting');
      expect(service.actionsClash(atk, cft)).toBe(true);
    });

    it('clashes (Crafting first)', () => {
      const cft = makeAction(1, 10, 20, 'Crafting');
      const atk = makeAction(2, 20, 10, 'Attack');
      expect(service.actionsClash(cft, atk)).toBe(true);
    });
  });

  describe('actionsClash — non-Attack combinations', () => {
    it('Defence vs Defence does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 10, 'Defence'),
        makeAction(2, 20, 20, 'Defence'),
      )).toBe(false);
    });

    it('Buff vs Buff does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 20, 'Buff'),
        makeAction(2, 30, 40, 'Buff'),
      )).toBe(false);
    });

    it('Counter vs Counter does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 20, 'Counter'),
        makeAction(2, 20, 10, 'Counter'),
      )).toBe(false);
    });

    it('Buff vs Debuff does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 20, 'Buff'),
        makeAction(2, 30, 40, 'Debuff'),
      )).toBe(false);
    });

    it('Healing vs Defence does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 20, 'Healing'),
        makeAction(2, 30, 30, 'Defence'),
      )).toBe(false);
    });

    it('Counter vs Defence does not clash', () => {
      expect(service.actionsClash(
        makeAction(1, 10, 20, 'Counter'),
        makeAction(2, 20, 10, 'Defence'),
      )).toBe(false);
    });
  });

  // ─── identifyClashes ─────────────────────────────────────────────────────────

  describe('identifyClashes', () => {
    it('returns empty arrays for an empty input', () => {
      const { clashes, independentActions } = service.identifyClashes([]);
      expect(clashes).toHaveLength(0);
      expect(independentActions).toHaveLength(0);
    });

    it('single action becomes independent', () => {
      const { clashes, independentActions } = service.identifyClashes([
        makeAction(1, 10, null, 'Buff'),
      ]);
      expect(clashes).toHaveLength(0);
      expect(independentActions).toHaveLength(1);
    });

    it('mutual attackers form one clash, no independents', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 20, 10, 'Attack');
      const { clashes, independentActions } = service.identifyClashes([a, b]);
      expect(clashes).toHaveLength(1);
      expect(clashes[0]).toContain(a);
      expect(clashes[0]).toContain(b);
      expect(independentActions).toHaveLength(0);
    });

    it('two unrelated attacks produce two independents', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 30, 40, 'Attack');
      const { clashes, independentActions } = service.identifyClashes([a, b]);
      expect(clashes).toHaveLength(0);
      expect(independentActions).toHaveLength(2);
    });

    it('separates a clash pair from an unrelated buff', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 20, 10, 'Attack');
      const c = makeAction(3, 30, 30, 'Buff'); // unrelated self-buff
      const { clashes, independentActions } = service.identifyClashes([a, b, c]);
      expect(clashes).toHaveLength(1);
      expect(independentActions).toHaveLength(1);
      expect(independentActions[0].id).toBe(3);
    });

    it('two independent clash pairs are detected separately', () => {
      const actions = [
        makeAction(1, 10, 20, 'Attack'),
        makeAction(2, 20, 10, 'Attack'),
        makeAction(3, 30, 40, 'Attack'),
        makeAction(4, 40, 30, 'Attack'),
      ];
      const { clashes, independentActions } = service.identifyClashes(actions);
      expect(clashes).toHaveLength(2);
      expect(independentActions).toHaveLength(0);
    });

    it('detects Attack vs Defence as a clash', () => {
      const atk = makeAction(1, 10, 20, 'Attack');
      const def = makeAction(2, 20, 20, 'Defence'); // char 20 self-defends
      const { clashes, independentActions } = service.identifyClashes([atk, def]);
      expect(clashes).toHaveLength(1);
      expect(independentActions).toHaveLength(0);
    });

    it('every action appears in exactly one group', () => {
      const actions = [
        makeAction(1, 10, 20, 'Attack'),
        makeAction(2, 20, 10, 'Attack'),
        makeAction(3, 30, 40, 'Attack'),
        makeAction(4, 50, 50, 'Buff'),
      ];
      const { clashes, independentActions } = service.identifyClashes(actions);
      const total = clashes.flat().length + independentActions.length;
      expect(total).toBe(actions.length);
    });

    it('already-clashed actions are not re-evaluated as independents', () => {
      const a = makeAction(1, 10, 20, 'Attack');
      const b = makeAction(2, 20, 10, 'Attack');
      const { clashes, independentActions } = service.identifyClashes([a, b]);
      const allIds = [...clashes.flat(), ...independentActions].map(x => x.id);
      expect(new Set(allIds).size).toBe(allIds.length); // no duplicates
    });
  });

  // ─── processIndependentAction ─────────────────────────────────────────────────

  describe('processIndependentAction', () => {
    it('sets isClash to false', () => {
      const result = service.processIndependentAction({
        characterData: { name: 'Alice' },
        skillData: { name: 'Strike', type: 'Attack', target: 'other' },
        targetData: { name: 'Bob' },
        finalOutput: 50,
        rollQuality: 'critical',
      });
      expect(result.isClash).toBe(false);
    });

    it('uses targetData.name when present', () => {
      const result = service.processIndependentAction({
        characterData: { name: 'Alice' },
        skillData: { name: 'Fireball', type: 'Attack', target: 'other' },
        targetData: { name: 'Bob' },
        finalOutput: 45,
        rollQuality: 'standard',
      });
      expect(result.target).toBe('Bob');
    });

    it('falls back to "Self" when skill targets self and targetData is absent', () => {
      const result = service.processIndependentAction({
        characterData: { name: 'Alice' },
        skillData: { name: 'Rejuvenate', type: 'Healing', target: 'self' },
        targetData: null,
        finalOutput: 30,
        rollQuality: 'standard',
      });
      expect(result.target).toBe('Self');
    });

    it('falls back to "Area" when targetData is absent and skill is not self-targeting', () => {
      const result = service.processIndependentAction({
        characterData: { name: 'Alice' },
        skillData: { name: 'War Cry', type: 'Buff', target: 'area' },
        targetData: null,
        finalOutput: 20,
        rollQuality: 'poor',
      });
      expect(result.target).toBe('Area');
    });

    it('passes through finalOutput and rollQuality', () => {
      const result = service.processIndependentAction({
        characterData: { name: 'Alice' },
        skillData: { name: 'Strike', type: 'Attack', target: 'other' },
        targetData: { name: 'Bob' },
        finalOutput: 77,
        rollQuality: 'critical',
      });
      expect(result.finalOutput).toBe(77);
      expect(result.rollQuality).toBe('critical');
    });
  });
});
