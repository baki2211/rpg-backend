# Dev Rulebook

> Rules for writing production code and tests in this repo. They come from Khorikov's
> *Unit Testing Principles, Practices, and Patterns* 
> the unit-testing-reviewer catalog, so review findings map back here. Reviewer config:
> [`.unit-testing-review.md`](../.unit-testing-review.md).

## 1. Where code goes

Every piece of code is one of four kinds. Decide which before writing it.

| Kind | Examples here | Lives in | Tested by |
|---|---|---|---|
| **Domain / algorithm**: decisions, formulas, rules | clash table, impact formula, derived stats, level-up, rank thresholds, d20 to multiplier | `src/domain/` | Unit tests, many edge cases, no mocks |
| **Controller**: gathers data, calls domain, persists, notifies | route handlers, `CombatActionService.submitAction`, `resolveRound` | `src/controllers/`, `src/services/`, `src/websockets/` | 1 integration happy path per scenario |
| **Trivial**: no logic | models, routes, `HttpError`, `asyncHandler`, CRUD services | wherever it is | Nothing |
| **Overcomplicated**: logic *and* many dependencies | none today (`SkillEngine` and `CombatResolutionService` were split) | nowhere: split it | Split first, then test the parts |

Code is either deep (complex) or wide (many collaborators), never both [§7.1] (A1).

## 2. Domain rules (`src/domain/`)

- **No I/O.** Domain modules never import `AppDataSource`, repositories, services, `logger`,
  Redis, `ws` or `fs`. If a formula needs stat definitions, ranks or usage counts, the caller
  loads them and passes them in as plain values [§5.3.1, §6.3] (A2).
- **No import-time side effects.** No `new SomeService()` or `getRepository()` at module level.
- **Plain inputs, plain outputs.** Functions take plain objects and numbers and return new values.
  They don't mutate arguments or save anything.
- **No hidden inputs.** No `Math.random()`, `Date.now()` or `new Date()` inside a decision.
  Roll the d20 or read the clock in the controller and pass the value in [§6.3.1, §11.6] (A4):
  ```js
  // domain
  export function outcomeMultiplierForRoll(roll) { /* 1..20 -> 0.6 | 1.0 | 1.4 */ }
  // controller (edge)
  const roll = rollD20();
  const multiplier = outcomeMultiplierForRoll(roll);
  ```
- **No module-global mutable state** (caches, counters). Caching belongs to the shell, keyed on
  every input that affects the result (including skill `basePower` and `scalingStats`).
- **One source of truth per rule.** Tables such as rank thresholds live in one domain module.
  `SkillEngine` and `SkillUsageService` both import it; neither keeps its own copy.
- **Commands or queries, not both** [§5.1.5] (A9). A function that returns a value doesn't
  change state. Return everything the caller needs (e.g. `{ finalOutput, outcomeMultiplier }`)
  so the caller never has to call a second method to find out what happened.

## 3. Controller rules

- **Controllers don't decide.** No business `if`s (who takes damage, whether a level-up
  happens, whether a skill is allowed) in route handlers or services. Ask the domain, then
  apply its answer [§7.4] (A3).
- **Shape of a controller:** validate input, load, call domain, persist, notify. Keep it short.
- **`await` every async call.** A missing `await` on `resolveClash` or `computeFinalOutput`
  yields a `Promise`, so `.winner` is `undefined`. This bug shipped in `SkillController.useSkill`.
- **Entities are plain objects** (`EntitySchema`, not active record). Persist with
  `repository.save(entity)` or `manager.save(Entity, entity)`. Never call `entity.save()`.
- **Use real column names.** Check `src/models/` first: HP is `stats.hp`, not `health`.
- **One business operation, one transaction** [§10.2.1] (A15). If an action is recorded and
  usage is incremented, both happen in the same `AppDataSource.transaction(async (manager) => ...)`.
  Services called from inside take an `EntityManager` argument rather than opening their own
  transaction.
- **Support logging is explicit.** Audit/support events go through `AuditLogger` (observable
  behavior). Diagnostic `logger` calls are free-form and never asserted in tests [§8.6] (A12, V9).

## 4. API design rules (any module)

- **Public API = observable behavior** [§5.2] (A8). Don't export helpers just so a test can
  reach them. If a private helper is complex enough to need its own test, extract it as a domain
  function (V2, A7).
- **No code pollution** [§11.4] (A6): no `if (process.env.NODE_ENV === 'test')`, no test-only
  parameters or flags in production code.
- **No single-implementation interfaces/wrappers for in-process code** [§8.4] (A5). Adapters
  are for unmanaged dependencies only.
- **Wrap third-party SDKs** that talk to unmanaged systems in an adapter we own (A14). None
  exist today; apply this when one is added (email, payments, external APIs).

## 5. Writing unit tests (`tests/unit/`)

- **Test behavior, not implementation** [§4.1] (V1). Assert on return values (best) or final
  state, never on which internal methods ran, cache TTLs or call order.
- **No mocks for domain code** [§9.2.1] (M1, M5). If you need `vi.mock` to import a module,
  the module is in the wrong layer: fix the code, not the test.
- **Hard-coded expected values** [§11.3] (V4, V5). Work the number out by hand and write the
  literal. Don't recompute it with the formula or production constants.
- **No randomness or real clock in tests** (S1, V6). Pass the roll or `now` as an argument.
  If a spy is unavoidable, `restoreMocks` must be on.
- **AAA, act is one line, no `if`s** [§3.1] (S2, S3, S4). Blank lines between sections.
- **Fixtures via small factory functions** (`makeAction`, `makeCharacter`), not shared mutable
  `beforeEach` state [§3.3] (S6).
- **Names are plain-English facts** a game designer could read, without method names:
  `counter_stronger_than_attack_hits_the_attacker`, not `resolveClashByTable_counter_returnsX` [§3.4] (S8).
- **Parameterize boundaries** with `it.each`, covering both sides of every threshold.
- **Don't test trivial code** (V3), repositories (V12) or diagnostic logs (V9).
- **Assert content, not just length.** Check which items ended up where, not only counts.

## 6. Writing integration tests (`tests/integration/`)

- **One happy path per business scenario** through HTTP (`supertest` against `src/app.js`),
  plus edge cases unit tests can't reach [§8.1].
- **Real Postgres** from `docker-compose.yml`, same version as production. No SQLite or
  in-memory substitutes [§10.3.3] (I1). Schema comes from migrations (I6).
- **Mock only unmanaged dependencies** at the very edge: WebSocket pushes (handwritten spy) and the d20
  module (`src/utils/dice.js` → `support/dice.js`) [§9.1] (M3, M6). Never mock Postgres, Redis or our own
  services.
- **Log in for real** (`support/auth.js`, cookie + CSRF), at most 5 logins per file (login rate limit).
  Mechanics in [`testing.md`](testing.md).
- **Clean data at test start**, not at the end; run integration tests sequentially (I3, I4).
- **Verify persisted state directly** by re-reading from the DB in a fresh query, not through
  the response alone (I5). Use separate transactions for arrange, act and assert (I2).

## 7. Coverage

Coverage is a negative indicator only: low coverage on `src/domain/` is a warning sign, but
never set a coverage target (V7). Aim for complete edge-case coverage of the domain and one
path per controller scenario.

## 8. Pre-merge checklist

- [ ] New rule or formula? It's in `src/domain/` with no I/O, randomness or clock, and has unit tests with literal expected values.
- [ ] Controller changed? It has no business `if`s, `await`s every promise, saves via repository/manager in **one** transaction.
- [ ] Touched a model field? The column name matches `src/models/`.
- [ ] New test file? No `vi.mock` in unit tests, no `Math.random`/`Date.now` dependence, AAA, plain-English names.
- [ ] New scenario/endpoint? One integration happy path against real Postgres.
- [ ] No exports, flags or branches added only for tests.
- [ ] Changed a model? Migration generated and verified ([`migrations.md`](migrations.md)).
- [ ] `npm test` passes; `npm run test:integration` passes if controllers, services or migrations changed.

<!-- KEEP THIS FILE UNDER ~200 LINES. -->
