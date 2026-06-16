/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 * @typedef {import('typeorm').QueryRunner} QueryRunner
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
export class InitialBaseline1781638978690 {
    name = 'InitialBaseline1781638978690'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "characters" ("id" SERIAL NOT NULL, "userId" integer, "name" character varying(50) NOT NULL, "surname" character varying(50) NOT NULL, "imageUrl" character varying(255), "age" integer NOT NULL, "gender" character varying(20) NOT NULL, "raceId" integer NOT NULL, "stats" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT false, "background" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "experience" double precision NOT NULL DEFAULT '0', "skillPoints" integer NOT NULL DEFAULT '5', "rank" integer NOT NULL DEFAULT '1', "statPoints" integer NOT NULL DEFAULT '0', "isNPC" boolean NOT NULL DEFAULT false, "createdBy" integer, CONSTRAINT "PK_9d731e05758f26b9315dac5e378" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "username" character varying(50) NOT NULL, "password" character varying(255) NOT NULL, "role" character varying(20) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "races" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL, "image" character varying, "healthBonus" integer NOT NULL DEFAULT '0', "manaBonus" integer NOT NULL DEFAULT '0', "speedBonus" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "focusBonus" integer NOT NULL DEFAULT '0', "controlBonus" integer NOT NULL DEFAULT '0', "resilienceBonus" integer NOT NULL DEFAULT '0', "instinctBonus" integer NOT NULL DEFAULT '0', "presenceBonus" integer NOT NULL DEFAULT '0', "forceBonus" integer NOT NULL DEFAULT '0', "isPlayable" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_baf8f0045fa05ba1149aedee823" UNIQUE ("name"), CONSTRAINT "PK_ba7d19b382156bc33244426c597" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skills" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "branchId" integer NOT NULL, "typeId" integer NOT NULL, "basePower" integer NOT NULL, "duration" integer NOT NULL, "activation" character varying(255) NOT NULL, "requiredStats" jsonb, "scalingStats" jsonb DEFAULT '[]', "aetherCost" integer NOT NULL, "skillPointCost" integer NOT NULL DEFAULT '1', "target" character varying(10) NOT NULL DEFAULT 'other', "rank" integer NOT NULL, "parentSkillId" integer, "isPassive" boolean NOT NULL, "unlockConditions" jsonb NOT NULL DEFAULT '{"uses":0,"combinations":[]}', "mutationOptions" jsonb, "comboTag" character varying(50), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0d3212120f4ecedf90864d7e298" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skill_branches" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "uses" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_b7c7a70ab91ab400752aca816b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skill_types" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, CONSTRAINT "PK_f98a760e950fc2f7376178e0689" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "character_skills" ("characterId" integer NOT NULL, "skillId" integer NOT NULL, "uses" integer NOT NULL DEFAULT '0', "unlockedAt" TIMESTAMP NOT NULL DEFAULT now(), "rank" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4bf5b4e7a2c3eb5cedd5dbe5514" PRIMARY KEY ("characterId", "skillId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_CHARACTER_SKILL_CHARACTER" ON "character_skills"  ("characterId") `);
        await queryRunner.query(`CREATE INDEX "IDX_CHARACTER_SKILL_SKILL" ON "character_skills"  ("skillId") `);
        await queryRunner.query(`CREATE TABLE "character_skill_branches" ("id" SERIAL NOT NULL, "characterId" integer NOT NULL, "branchId" integer NOT NULL, "uses" integer NOT NULL DEFAULT '0', "rank" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d6769c1073a2f9d84845fd9ac97" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_CHARACTER_SKILL_BRANCH_UNIQUE" ON "character_skill_branches"  ("characterId", "branchId") `);
        await queryRunner.query(`CREATE TABLE "locations" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "description" text NOT NULL, "xCoordinate" integer NOT NULL, "yCoordinate" integer NOT NULL, "mapId" integer, CONSTRAINT "PK_7cc1c9e3853b94816c094825e74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "maps" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "imageUrl" character varying NOT NULL, "isMainMap" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dddaabaf432b881f9f6e13bf9bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "chat_messages" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "characterId" integer, "username" character varying(100) NOT NULL, "message" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "skillId" integer, "skillName" character varying(100), "skillBranch" character varying(100), "skillType" character varying(100), "skillOutput" integer, "skillRoll" character varying(100), "locationId" integer, CONSTRAINT "PK_40c55ee0e571e268b0d3cd37d10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "locationId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "isEvent" boolean NOT NULL DEFAULT false, "eventId" integer, "status" character varying(20) NOT NULL DEFAULT 'open', "expirationTime" TIMESTAMP, CONSTRAINT "REL_61e25b191dd6844e30ff86e91f" UNIQUE ("eventId"), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "session_participants" ("id" SERIAL NOT NULL, "sessionId" integer NOT NULL, "characterId" integer NOT NULL, "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f186de01f7f809e45eaa9bd5b84" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "combat_rounds" ("id" SERIAL NOT NULL, "roundNumber" integer NOT NULL, "locationId" integer NOT NULL, "sessionId" integer, "eventId" integer, "status" character varying(20) NOT NULL DEFAULT 'active', "createdBy" integer NOT NULL, "resolvedBy" integer, "resolutionData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "resolvedAt" TIMESTAMP, CONSTRAINT "PK_bb0901846a4bb7779e479506faf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ROUND_LOCATION" ON "combat_rounds"  ("locationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ROUND_SESSION" ON "combat_rounds"  ("sessionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ROUND_EVENT" ON "combat_rounds"  ("eventId") `);
        await queryRunner.query(`CREATE TABLE "combat_actions" ("id" SERIAL NOT NULL, "roundId" integer NOT NULL, "characterId" integer NOT NULL, "skillId" integer NOT NULL, "targetId" integer, "finalOutput" integer NOT NULL, "outcomeMultiplier" numeric(3,2) NOT NULL, "rollQuality" character varying(20) NOT NULL, "skillData" jsonb, "characterData" jsonb, "targetData" jsonb, "submittedAt" TIMESTAMP NOT NULL DEFAULT now(), "processed" boolean NOT NULL DEFAULT false, "clashResult" jsonb, CONSTRAINT "PK_38295ce6124f75d944656c55598" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ACTION_ROUND" ON "combat_actions"  ("roundId") `);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_ACTION_CHARACTER" ON "combat_actions"  ("characterId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_COMBAT_ACTION_UNIQUE_PER_ROUND" ON "combat_actions"  ("roundId", "characterId") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "type" character varying(20) NOT NULL, "description" text, "locationId" integer NOT NULL, "sessionId" integer, "status" character varying(20) NOT NULL DEFAULT 'active', "createdBy" integer NOT NULL, "closedBy" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "closedAt" TIMESTAMP, "eventData" jsonb, CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_LOCATION" ON "events"  ("locationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_SESSION" ON "events"  ("sessionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_EVENT_STATUS" ON "events"  ("status") `);
        await queryRunner.query(`CREATE TABLE "engine_logs" ("id" SERIAL NOT NULL, "sessionId" integer NOT NULL, "locationId" integer NOT NULL, "type" character varying(20) NOT NULL, "actor" character varying(100) NOT NULL, "target" character varying(100), "skill" character varying(100), "damage" integer, "effects" jsonb, "details" text NOT NULL, "engineData" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8fd4306708cf53d7070841ec900" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ENGINE_LOG_SESSION" ON "engine_logs"  ("sessionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ENGINE_LOG_LOCATION" ON "engine_logs"  ("locationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ENGINE_LOG_TYPE" ON "engine_logs"  ("type") `);
        await queryRunner.query(`CREATE TABLE "stat_definitions" ("id" SERIAL NOT NULL, "internalName" character varying(50) NOT NULL, "displayName" character varying(100) NOT NULL, "description" text, "category" character varying(20) NOT NULL, "defaultValue" integer NOT NULL DEFAULT '0', "maxValue" integer DEFAULT '100', "minValue" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1729a85785a4130784a5f83c0b1" UNIQUE ("internalName"), CONSTRAINT "PK_5eda92acf12c7468e1aeafa5ca2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_STAT_DEFINITION_CATEGORY" ON "stat_definitions"  ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_STAT_DEFINITION_ACTIVE" ON "stat_definitions"  ("isActive") `);
        await queryRunner.query(`CREATE TABLE "combat_constants" ("id" SERIAL NOT NULL, "constantKey" character varying(100) NOT NULL, "displayName" character varying(200) NOT NULL, "description" text, "value" numeric(10,4) NOT NULL, "category" character varying(50) NOT NULL, "minValue" numeric(10,4), "maxValue" numeric(10,4), "isPercentage" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_83719bc9536eacf7e11a5d366c2" UNIQUE ("constantKey"), CONSTRAINT "PK_5e874ef5e5f28146e5ab4fbcd04" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_CONSTANT_CATEGORY" ON "combat_constants"  ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_CONSTANT_ACTIVE" ON "combat_constants"  ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_COMBAT_CONSTANT_KEY" ON "combat_constants"  ("constantKey") `);
        await queryRunner.query(`CREATE TABLE "mastery_tiers" ("id" SERIAL NOT NULL, "tier" integer NOT NULL, "tierName" character varying(100) NOT NULL, "usesRequired" integer NOT NULL DEFAULT '0', "multiplier" numeric(5,2) NOT NULL DEFAULT '1', "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0d16c0a5c76452ca49ae45cb69c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_MASTERY_TIER" ON "mastery_tiers"  ("tier") `);
        await queryRunner.query(`CREATE INDEX "IDX_MASTERY_ACTIVE" ON "mastery_tiers"  ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_MASTERY_USES" ON "mastery_tiers"  ("usesRequired") `);
        await queryRunner.query(`CREATE TABLE "skill_validation_rules" ("id" SERIAL NOT NULL, "skillType" character varying(50) NOT NULL, "skillSubtype" character varying(50) NOT NULL, "minBasePower" integer NOT NULL DEFAULT '0', "maxBasePower" integer NOT NULL DEFAULT '100', "minAetherCost" integer NOT NULL DEFAULT '0', "maxAetherCost" integer NOT NULL DEFAULT '100', "description" text, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dc346d4bfa1d42039c4b81ed0e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_SKILL_VALIDATION_TYPE" ON "skill_validation_rules"  ("skillType") `);
        await queryRunner.query(`CREATE INDEX "IDX_SKILL_VALIDATION_SUBTYPE" ON "skill_validation_rules"  ("skillSubtype") `);
        await queryRunner.query(`CREATE INDEX "IDX_SKILL_VALIDATION_ACTIVE" ON "skill_validation_rules"  ("isActive") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_SKILL_VALIDATION_TYPE_SUBTYPE" ON "skill_validation_rules"  ("skillType", "skillSubtype") `);
        await queryRunner.query(`CREATE TABLE "ranks" ("level" integer NOT NULL, "requiredExperience" integer NOT NULL, "statPoints" integer NOT NULL DEFAULT '0', "skillPoints" integer NOT NULL DEFAULT '0', "aetherPercent" double precision NOT NULL DEFAULT '0', "hpPercent" double precision NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_19e7e9c244534fdaf01ede4b889" PRIMARY KEY ("level"))`);
        await queryRunner.query(`CREATE TABLE "wiki_sections" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "description" text, "position" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdBy" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_52f8704d79854c235d0e1b60ddc" UNIQUE ("slug"), CONSTRAINT "PK_5f8630d0a772d29db7dc796de5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_WIKI_SECTION_SLUG" ON "wiki_sections"  ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_SECTION_POSITION" ON "wiki_sections"  ("position") `);
        await queryRunner.query(`CREATE TABLE "wiki_entries" ("id" SERIAL NOT NULL, "sectionId" integer NOT NULL, "title" character varying(200) NOT NULL, "slug" character varying(200) NOT NULL, "content" text NOT NULL, "excerpt" text, "tags" jsonb DEFAULT '[]', "isPublished" boolean NOT NULL DEFAULT true, "position" integer NOT NULL DEFAULT '0', "parentEntryId" integer, "level" integer NOT NULL DEFAULT '1', "viewCount" integer NOT NULL DEFAULT '0', "createdBy" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1c9bb0552fb9820241a75296515" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_WIKI_ENTRY_SECTION_SLUG" ON "wiki_entries"  ("sectionId", "slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_ENTRY_SECTION_POSITION" ON "wiki_entries"  ("sectionId", "position") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_ENTRY_PUBLISHED" ON "wiki_entries"  ("isPublished") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_ENTRY_TAGS" ON "wiki_entries"  ("tags") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_ENTRY_PARENT" ON "wiki_entries"  ("parentEntryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_WIKI_ENTRY_LEVEL" ON "wiki_entries"  ("level") `);
        await queryRunner.query(`ALTER TABLE "characters" ADD CONSTRAINT "FK_7c1bf02092d401b55ecc243ef1f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "characters" ADD CONSTRAINT "FK_8f740d2f79d00636b1dfe76a747" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "characters" ADD CONSTRAINT "FK_4a40faa39e22b976e1e17f8c110" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills" ADD CONSTRAINT "FK_8a5207d9519f3d88433ffa5def3" FOREIGN KEY ("parentSkillId") REFERENCES "skills"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills" ADD CONSTRAINT "FK_858f368d469c7ac9e89db254ccb" FOREIGN KEY ("branchId") REFERENCES "skill_branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skills" ADD CONSTRAINT "FK_4c2b928836e2e895081ff189729" FOREIGN KEY ("typeId") REFERENCES "skill_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "character_skills" ADD CONSTRAINT "FK_cfab2fe97a7f1b2506638e81954" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "character_skills" ADD CONSTRAINT "FK_674f4e9faa4846d43385997746b" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "character_skill_branches" ADD CONSTRAINT "FK_28b7e88e16bd24cf08ee4944cd0" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "character_skill_branches" ADD CONSTRAINT "FK_a7e1a12c4775ead0dd28866a4e5" FOREIGN KEY ("branchId") REFERENCES "skill_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "locations" ADD CONSTRAINT "FK_e2c3610fb03715513aa75f0b561" FOREIGN KEY ("mapId") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_a17825d4a329f8c81f2c098968a" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_61e25b191dd6844e30ff86e91ff" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session_participants" ADD CONSTRAINT "FK_405fbf7474a2df8d2131619ad1d" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session_participants" ADD CONSTRAINT "FK_0b33a3c666bef59d51b313aa799" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_rounds" ADD CONSTRAINT "FK_b9d9e05cf91425f5c0353076048" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_rounds" ADD CONSTRAINT "FK_a680498b6c0024013cc194c7bd2" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_actions" ADD CONSTRAINT "FK_d17e6ba038b32688c549ac5d9ba" FOREIGN KEY ("roundId") REFERENCES "combat_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_actions" ADD CONSTRAINT "FK_de3690c865ed73a7540ef094d74" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_actions" ADD CONSTRAINT "FK_8d0b7bbb7a3bbdb6afc3712a7dc" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "combat_actions" ADD CONSTRAINT "FK_0a3c63c0d35f5927eef3927c57a" FOREIGN KEY ("targetId") REFERENCES "characters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_a00c43630825e2bf55c9cb5d357" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "engine_logs" ADD CONSTRAINT "FK_d2b96bbf1cd1748981bf9237164" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wiki_sections" ADD CONSTRAINT "FK_9d89da87a55708138fdd703ff67" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" ADD CONSTRAINT "FK_66a1ddd35a20c2000cd7ee1b598" FOREIGN KEY ("sectionId") REFERENCES "wiki_sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" ADD CONSTRAINT "FK_2e09d937ea43877b7eee229714b" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" ADD CONSTRAINT "FK_1aed93b63c73c9b73b3ee9541f8" FOREIGN KEY ("parentEntryId") REFERENCES "wiki_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wiki_entries" DROP CONSTRAINT "FK_1aed93b63c73c9b73b3ee9541f8"`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" DROP CONSTRAINT "FK_2e09d937ea43877b7eee229714b"`);
        await queryRunner.query(`ALTER TABLE "wiki_entries" DROP CONSTRAINT "FK_66a1ddd35a20c2000cd7ee1b598"`);
        await queryRunner.query(`ALTER TABLE "wiki_sections" DROP CONSTRAINT "FK_9d89da87a55708138fdd703ff67"`);
        await queryRunner.query(`ALTER TABLE "engine_logs" DROP CONSTRAINT "FK_d2b96bbf1cd1748981bf9237164"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_a00c43630825e2bf55c9cb5d357"`);
        await queryRunner.query(`ALTER TABLE "combat_actions" DROP CONSTRAINT "FK_0a3c63c0d35f5927eef3927c57a"`);
        await queryRunner.query(`ALTER TABLE "combat_actions" DROP CONSTRAINT "FK_8d0b7bbb7a3bbdb6afc3712a7dc"`);
        await queryRunner.query(`ALTER TABLE "combat_actions" DROP CONSTRAINT "FK_de3690c865ed73a7540ef094d74"`);
        await queryRunner.query(`ALTER TABLE "combat_actions" DROP CONSTRAINT "FK_d17e6ba038b32688c549ac5d9ba"`);
        await queryRunner.query(`ALTER TABLE "combat_rounds" DROP CONSTRAINT "FK_a680498b6c0024013cc194c7bd2"`);
        await queryRunner.query(`ALTER TABLE "combat_rounds" DROP CONSTRAINT "FK_b9d9e05cf91425f5c0353076048"`);
        await queryRunner.query(`ALTER TABLE "session_participants" DROP CONSTRAINT "FK_0b33a3c666bef59d51b313aa799"`);
        await queryRunner.query(`ALTER TABLE "session_participants" DROP CONSTRAINT "FK_405fbf7474a2df8d2131619ad1d"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_61e25b191dd6844e30ff86e91ff"`);
        await queryRunner.query(`ALTER TABLE "chat_messages" DROP CONSTRAINT "FK_a17825d4a329f8c81f2c098968a"`);
        await queryRunner.query(`ALTER TABLE "locations" DROP CONSTRAINT "FK_e2c3610fb03715513aa75f0b561"`);
        await queryRunner.query(`ALTER TABLE "character_skill_branches" DROP CONSTRAINT "FK_a7e1a12c4775ead0dd28866a4e5"`);
        await queryRunner.query(`ALTER TABLE "character_skill_branches" DROP CONSTRAINT "FK_28b7e88e16bd24cf08ee4944cd0"`);
        await queryRunner.query(`ALTER TABLE "character_skills" DROP CONSTRAINT "FK_674f4e9faa4846d43385997746b"`);
        await queryRunner.query(`ALTER TABLE "character_skills" DROP CONSTRAINT "FK_cfab2fe97a7f1b2506638e81954"`);
        await queryRunner.query(`ALTER TABLE "skills" DROP CONSTRAINT "FK_4c2b928836e2e895081ff189729"`);
        await queryRunner.query(`ALTER TABLE "skills" DROP CONSTRAINT "FK_858f368d469c7ac9e89db254ccb"`);
        await queryRunner.query(`ALTER TABLE "skills" DROP CONSTRAINT "FK_8a5207d9519f3d88433ffa5def3"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP CONSTRAINT "FK_4a40faa39e22b976e1e17f8c110"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP CONSTRAINT "FK_8f740d2f79d00636b1dfe76a747"`);
        await queryRunner.query(`ALTER TABLE "characters" DROP CONSTRAINT "FK_7c1bf02092d401b55ecc243ef1f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_LEVEL"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_PARENT"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_TAGS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_PUBLISHED"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_SECTION_POSITION"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_ENTRY_SECTION_SLUG"`);
        await queryRunner.query(`DROP TABLE "wiki_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_SECTION_POSITION"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_WIKI_SECTION_SLUG"`);
        await queryRunner.query(`DROP TABLE "wiki_sections"`);
        await queryRunner.query(`DROP TABLE "ranks"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SKILL_VALIDATION_TYPE_SUBTYPE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SKILL_VALIDATION_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SKILL_VALIDATION_SUBTYPE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_SKILL_VALIDATION_TYPE"`);
        await queryRunner.query(`DROP TABLE "skill_validation_rules"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_MASTERY_USES"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_MASTERY_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_MASTERY_TIER"`);
        await queryRunner.query(`DROP TABLE "mastery_tiers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_CONSTANT_KEY"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_CONSTANT_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_CONSTANT_CATEGORY"`);
        await queryRunner.query(`DROP TABLE "combat_constants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_STAT_DEFINITION_ACTIVE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_STAT_DEFINITION_CATEGORY"`);
        await queryRunner.query(`DROP TABLE "stat_definitions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ENGINE_LOG_TYPE"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ENGINE_LOG_LOCATION"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ENGINE_LOG_SESSION"`);
        await queryRunner.query(`DROP TABLE "engine_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_EVENT_STATUS"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_EVENT_SESSION"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_EVENT_LOCATION"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ACTION_UNIQUE_PER_ROUND"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ACTION_CHARACTER"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ACTION_ROUND"`);
        await queryRunner.query(`DROP TABLE "combat_actions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ROUND_EVENT"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ROUND_SESSION"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_COMBAT_ROUND_LOCATION"`);
        await queryRunner.query(`DROP TABLE "combat_rounds"`);
        await queryRunner.query(`DROP TABLE "session_participants"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "chat_messages"`);
        await queryRunner.query(`DROP TABLE "maps"`);
        await queryRunner.query(`DROP TABLE "locations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHARACTER_SKILL_BRANCH_UNIQUE"`);
        await queryRunner.query(`DROP TABLE "character_skill_branches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHARACTER_SKILL_SKILL"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_CHARACTER_SKILL_CHARACTER"`);
        await queryRunner.query(`DROP TABLE "character_skills"`);
        await queryRunner.query(`DROP TABLE "skill_types"`);
        await queryRunner.query(`DROP TABLE "skill_branches"`);
        await queryRunner.query(`DROP TABLE "skills"`);
        await queryRunner.query(`DROP TABLE "races"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "characters"`);
    }
}
