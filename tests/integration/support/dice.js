/**
 * Stand-in for src/utils/dice.js, the one module that reads randomness. Every d20 is 11:
 * a Standard success, outcome multiplier 1.0 with the default table. In a test file:
 *
 *   vi.mock('../../src/utils/dice.js', () => import('./support/dice.js'));
 */
export const STANDARD_ROLL = 11;

export function rollD20() {
  return STANDARD_ROLL;
}
