import { describe, it, expect } from 'vitest';
import { inCharacterLockOrder } from '../../../src/utils/rowLocks.js';

const makeUse = (characterId, skillId) => ({ characterId, skillId });

describe('order in which per-character rows are locked', () => {
  it.each([
    ['attacker has the lower id', [makeUse(3, 30), makeUse(8, 80)], [makeUse(3, 30), makeUse(8, 80)]],
    ['defender has the lower id', [makeUse(8, 80), makeUse(3, 30)], [makeUse(3, 30), makeUse(8, 80)]],
    ['ids compare as numbers, not text', [makeUse(10, 100), makeUse(9, 90)], [makeUse(9, 90), makeUse(10, 100)]],
    ['a character on both sides keeps the given order', [makeUse(5, 51), makeUse(5, 52)], [makeUse(5, 51), makeUse(5, 52)]],
  ])('%s', (_name, uses, expected) => {
    const ordered = inCharacterLockOrder(uses);

    expect(ordered).toEqual(expected);
  });

  it('the caller\'s list is left unchanged', () => {
    const uses = [makeUse(8, 80), makeUse(3, 30)];

    inCharacterLockOrder(uses);

    expect(uses).toEqual([makeUse(8, 80), makeUse(3, 30)]);
  });
});
