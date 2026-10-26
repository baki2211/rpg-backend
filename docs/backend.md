# Backend (Domain, Services, Middleware, Jobs, Utils)

> What lives where on the server side. Request flow and layering rules are in
> [`architecture.md`](architecture.md); the rules themselves in [`game_design.md`](game_design.md).

## Domain (`src/domain/`)

Pure functions, no I/O (see [`dev_rulebook.md`](dev_rulebook.md) §2). Each has a unit test file in
`tests/unit/domain/`.

| Module | Rules | Used by |
|---|---|---|
| `roles.js` | `MASTER_OR_ADMIN_ROLES`, `ALL_ROLES` | routes, `UserService`, `ChatWebSocket` |
| `character/stats.js` | stat bounds, unknown keys, derived stats, `levelUp` | `CharacterStatsService`, `NPCService` |
| `character/statPoints.js` | 45-point primary pool | `CharacterService`, `CharacterStatsService` |
| `character/npcUpdate.js` | fields a master may edit on an NPC | `NPCService` |
| `character/characterImage.js`, `imageFileLocks.js` | portrait URLs, placeholder, which files to lock/delete | `CharacterService`, `MapService`, `utils/uploadedFiles.js` |
| `chat/messageRewards.js` | chat XP and valid-post rule | `ChatService` |
| `chat/skillUse.js` | how a skill attached to a chat post is handled | `ChatService` |
| `combat/roundClashes.js` | clash pairing within a round | `CombatResolutionService` |
| `combat/clashTable.js` | type categories, clash table | `PvPResolutionService` |
| `combat/clashDamage.js` | apply clash damage to `stats.hp` | `SkillController` |
| `combat/pvpAuthorization.js` | who may resolve a PvP encounter | `PvPController` |
| `skills/output.js` | impact, final output | `SkillEngine` |
| `skills/outcome.js` | d20 → quality / multiplier | `SkillExecutionService`, `CombatConstantService` |
| `skills/ranks.js` | skill and branch rank ladders | `SkillUsageService`, `MasteryTierService` |
| `skills/rules.js` | DB rows → rule tables (`skillRulesFromRows`) | `staticDataCache` |
| `skills/skillCost.js` (+ `aetherCost.js`) | aether cost and `requiredStats` gate | `SkillEngine` |
| `skills/acquisition.js` | learning a skill | `CharacterSkillsService` |

## Services (`src/services/`)

### Characters
- `CharacterService`: PC CRUD, image, activation (one active character per user), `getActiveCharacter`
  (read-only, PC vs controlled NPC), `findCharacterWithSkillsAndRace`.
- `CharacterStatsService`: loads stat definitions and ranks, calls `domain/character/stats.js`; recomputes
  derived stats on stat update and level-up, and for every character via `recomputeAllDerivedStats`.
- `NPCService`: NPC CRUD, `activateNPC` / `deactivateNPC` (a master temporarily controls an NPC).
- `CharacterSkillsService`: `acquireSkill`, available / acquired skills.

### Skills
- `SkillEngine`: thin shell over `domain/skills`: loads usage counts, active primary stats and the rule
  tables; `computeFinalOutput(roll)`, `statsAfterCost()`.
- `SkillExecutionService`: computes or accepts a pre-calculated output for combat and chat.
- `SkillUsageService.incrementSkillUsage(…, manager)` / `incrementSkillUsages`: one use per skill and
  branch, inside the caller's transaction.
- `TargetResolutionService`: resolves `self / other / any / none`.
- Catalog CRUD: `SkillService`, `SkillBranchService`, `SkillTypeService`, `MasteryTierService`,
  `SkillValidationRuleService`, `StatDefinitionService`, `CombatConstantService`, `RankService`.

### Sessions, events, chat
- `SessionService` (CRUD, location lookup), `SessionLifecycleService` (status, freeze, close),
  `SessionParticipantService` (join/leave, `ensureActiveSessionForLocation`), `SessionQueryService`
  (admin lists).
- `EventService`: turns the location's free-role session into an event session and back.
- `ChatService`: posts in one transaction: message, XP, and an attached skill (combat action or
  standalone use).

### Combat
- `CombatService`: round CRUD and numbering.
- `CombatActionService.submitAction`: one transaction: action + use count.
- `CombatResolutionService.resolveRound`: pairing (`roundClashes`), resolution, engine log.
- `PvPService`: `/api/pvp/resolve` orchestration (load, roll, lock, count uses).
- `PvPResolutionService`: computes both outputs and applies the clash table; records nothing.
- `EngineLogService`: engine log rows.

### Other
- `UserService` (register, login, roles), `RaceService`, `MapService`, `LocationService`.
- Wiki: `WikiSectionService`, `WikiEntryService`, `WikiSearchService`.

## Controllers (`src/controllers/`)

One per domain, static methods wrapped in `asyncHandler`. They validate with `InputValidator`, call one
service, and return `{ message, data? }`-style JSON; errors are `HttpError`s rendered by `errorHandler`.

## Middleware (`src/middleware/`)

- `authMiddleware.js`: `authenticateToken` (cookie JWT; failures → `AuditLogger` `UNAUTHORIZED_ACCESS`),
  `requireRole(roles)`.
- `adminMiddleware.js`: `isAdmin`, the older admin check (maps, races, health, query stats).
- `csrfMiddleware.js`: `verifyCsrfToken` (mounted on `/api`), `setCsrfCookie` (login/refresh).
- `rateLimitMiddleware.js`: `generalApiLimit`, `authAttemptLimit` (5 / 15 min), `combatActionLimit`,
  `characterOperationLimit`, `skillUsageLimit`, `chatMessageLimit`. (`/api/health` has its own
  limiter inside `routes/healthRoutes.js`.) Store from `rateLimitStores.js`:
  in-memory, or Redis when `REDIS_URL` is set (created in `startServer()`).
- `compressionMiddleware.js`, `queryMonitoringMiddleware.js`, `uploadMiddleware.js` (multer),
  `errorHandler.js`, `cookie-parser.js` (local wrapper).

## WebSockets (`src/websockets/`)

- `upgradeHandler.js`: `/ws/chat` only; cookie JWT; memory-based connection cap.
- `ChatWebSocket.js`: chat rooms, pushes.

## Jobs (`src/jobs/`)

- `seed.js`: dev/bootstrap data (see [`database.md`](database.md)).
- `sessionExpiration.js`, `memoryCleanup.js`: see [`architecture.md`](architecture.md#background-jobs).

## Utils (`src/utils/`)

| File | Purpose |
|---|---|
| `logger.js` | diagnostic logger; use it, not `console.log` |
| `auditLogger.js` | security/support events (`EventTypes`, `RiskLevels`); observable, keep calls |
| `HttpError.js` | `HttpError`, `httpResponseForError` (pure) |
| `asyncHandler.js` | forwards async errors to `errorHandler` |
| `inputValidator.js` | `validateId`, `validateLimit` (1..100), `validateInteger`, `validateText`, ... |
| `dice.js` | `rollD20()`, the only `Math.random` in game code |
| `rowLocks.js` | `lockUser`, `lockCharacter(s)`, `inCharacterLockOrder` |
| `advisoryLock.js` | `withAdvisoryLock` for jobs, transaction-scoped name locks |
| `uploadedFiles.js` | safe deletion of uploaded images (reference check under lock) |
| `staticDataCache.js` | read-mostly table cache, `getSkillRules()` |
| `healthStatus.js` | pure overload decision for `/api/health` |
| `withTimeout.js` | promise timeout helper |
| `memoryManager.js`, `dbHealthMonitor.js`, `queryMonitor.js`, `monitoredRepositories.js` | runtime monitoring |

## Related

[`api.md`](api.md) · [`architecture.md`](architecture.md) · [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)
