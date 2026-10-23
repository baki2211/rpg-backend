import { In } from 'typeorm';
import { Character } from '../models/characterModel.js';
import { User } from '../models/userModel.js';

// Row locks for read-modify-write inside a transaction (SELECT ... FOR UPDATE).
// Lock order across the app: users, then characters (by id), then usage rows (character_skills,
// character_skill_branches), so two operations on the same rows never wait on each other in a cycle.

/**
 * Re-read a character inside the transaction and hold its row until commit.
 * @param {import('typeorm').EntityManager} manager
 * @param {number} id
 * @returns {Promise<Object|null>} The current row (no relations)
 */
export function lockCharacter(manager, id) {
  return manager.getRepository(Character).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
}

/**
 * Lock several characters in id order (one statement) and return them by id.
 * @param {import('typeorm').EntityManager} manager
 * @param {number[]} ids
 * @returns {Promise<Map<number, Object>>}
 */
export async function lockCharacters(manager, ids) {
  const rows = await manager.getRepository(Character).find({
    where: { id: In([...new Set(ids)]) },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' }
  });
  return new Map(rows.map(row => [row.id, row]));
}

/**
 * Lock a user row. Serializes the operations that change which character a user plays.
 * @param {import('typeorm').EntityManager} manager
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export function lockUser(manager, id) {
  return manager.getRepository(User).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
}
