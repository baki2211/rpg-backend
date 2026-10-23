import bcrypt from 'bcrypt';
import { AppDataSource } from '../../../src/data-source.js';
import { User } from '../../../src/models/userModel.js';
import { Race } from '../../../src/models/raceModel.js';
import { Location } from '../../../src/models/locationModel.js';
import { Character } from '../../../src/models/characterModel.js';
import { SkillType } from '../../../src/models/skillTypeModel.js';
import { SkillBranch } from '../../../src/models/skillBranchModel.js';
import { Skill } from '../../../src/models/skillModel.js';
import { CharacterSkill } from '../../../src/models/characterSkillModel.js';
import { Rank } from '../../../src/models/rankModel.js';
import { Session } from '../../../src/models/sessionModel.js';
import { Event } from '../../../src/models/eventModel.js';
import { CombatRound } from '../../../src/models/combatRoundModel.js';
import { MasteryTier } from '../../../src/models/masteryTierModel.js';
import { CombatConstant } from '../../../src/models/combatConstantModel.js';
import { StatDefinition } from '../../../src/models/statDefinitionModel.js';

// Arrange helpers. Each one inserts a row through a repository (its own autocommit write,
// separate from the request under test) and returns the saved entity.
// Pass only the fields the test cares about; everything else gets a valid default.

export const TEST_PASSWORD = 'correct-horse-battery';

let sequence = 0;
const next = () => ++sequence;

const save = (entity, fields) => {
  const repository = AppDataSource.getRepository(entity);
  return repository.save(repository.create(fields));
};

/** A user who can log in with TEST_PASSWORD. Use `logIn(app, user)` from auth.js. */
export async function makeUser({ role = 'user', username = `player${next()}` } = {}) {
  const user = await save(User, { username, role, password: await bcrypt.hash(TEST_PASSWORD, 4) });
  return { ...user, password: TEST_PASSWORD };
}

export function makeRace(fields = {}) {
  return save(Race, { name: `Race ${next()}`, description: 'Test race', ...fields });
}

export function makeLocation(fields = {}) {
  return save(Location, { name: `Location ${next()}`, description: 'Test location', xCoordinate: 0, yCoordinate: 0, ...fields });
}

/** A playable character. `stats` is the jsonb column: HP is stats.hp, aether is stats.aether. */
export async function makeCharacter({ user, race, stats = { hp: 50, aether: 30 }, isActive = true, ...fields } = {}) {
  return save(Character, {
    userId: user?.id ?? null,
    raceId: (race ?? (await makeRace())).id,
    name: `Hero${next()}`,
    surname: 'Tester',
    age: 30,
    gender: 'other',
    stats,
    isActive,
    ...fields,
  });
}

/** Skill types are matched by name in the clash table: 'Attack', 'Defence', 'Counter', 'Buff', ... */
export function makeSkillType(name) {
  return save(SkillType, { name });
}

export function makeSkillBranch(fields = {}) {
  return save(SkillBranch, { name: `Branch ${next()}`, ...fields });
}

/**
 * A skill. With the default `scalingStats: []` the impact is exactly `basePower`,
 * so a fresh character (0 uses) with a Standard roll outputs basePower * (1.0 + 1.0) * 1.0.
 */
export async function makeSkill({ type, branch, ...fields } = {}) {
  return save(Skill, {
    name: `Skill ${next()}`,
    typeId: (type ?? (await makeSkillType('Attack'))).id,
    branchId: (branch ?? (await makeSkillBranch())).id,
    basePower: 10,
    duration: 1,
    activation: 'instant',
    scalingStats: [],
    aetherCost: 0,
    skillPointCost: 1,
    target: 'other',
    rank: 1,
    isPassive: false,
    ...fields,
  });
}

/** A stat definition: the stats a character may have (`internalName` is the key in the `stats` jsonb). */
export function makeStatDefinition(fields) {
  return save(StatDefinition, { minValue: 1, maxValue: 20, defaultValue: 1, isActive: true, ...fields });
}

/** The character has learned the skill (character_skills row). */
export function giveSkill(character, skill, { uses = 0 } = {}) {
  return save(CharacterSkill, { characterId: character.id, skillId: skill.id, uses });
}

export function makeRank(fields) {
  return save(Rank, { statPoints: 0, skillPoints: 0, aetherPercent: 0, hpPercent: 0, ...fields });
}

export function makeSession({ location, ...fields }) {
  return save(Session, { name: `Session ${next()}`, locationId: location.id, isActive: true, status: 'open', ...fields });
}

export function makeEvent({ location, createdBy, ...fields }) {
  return save(Event, { title: `Event ${next()}`, type: 'lore', locationId: location.id, createdBy: createdBy.id, status: 'active', ...fields });
}

export function makeCombatRound({ location, createdBy, session = null, event = null, ...fields }) {
  return save(CombatRound, {
    roundNumber: 1,
    locationId: location.id,
    sessionId: session?.id ?? null,
    eventId: event?.id ?? null,
    createdBy: createdBy.id,
    status: 'active',
    ...fields,
  });
}

/** A mastery tier: the active tiers are the skill rank ladder (tier = rank, usesRequired, multiplier). */
export function makeMasteryTier({ tier, usesRequired, multiplier, ...fields }) {
  return save(MasteryTier, { tier, tierName: `Tier ${tier}`, usesRequired, multiplier, isActive: true, ...fields });
}

/** A game tunable row, e.g. OUTCOME_STANDARD_MULT or MASTERY_TIER_1 (branch rank I multiplier). */
export function makeCombatConstant({ constantKey, value, category = 'outcome_system', ...fields }) {
  return save(CombatConstant, { constantKey, value, category, displayName: constantKey, isActive: true, ...fields });
}
