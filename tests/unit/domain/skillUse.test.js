import { describe, it, expect } from 'vitest';
import { planChatSkillUse } from '../../../src/domain/chat/skillUse.js';

const makeContext = (overrides = {}) => ({
    skillTarget: 'other',
    hasSelectedTarget: true,
    hasActiveEvent: false,
    hasActiveRound: false,
    grantsExperience: false,
    ...overrides,
});

describe('using a skill in chat', () => {
    it('a skill aimed at another player outside any event or round is refused', () => {
        const context = makeContext({ hasActiveEvent: false, hasActiveRound: false });

        const plan = planChatSkillUse(context);

        expect(plan).toEqual({
            allowed: false,
            error: 'Skills targeting other players can only be used during active events or combat rounds',
            submitToCombat: false,
            incrementUsageInChat: false,
            writeEngineLog: false,
        });
    });

    it.each([
        ['during an event without a round it stays in chat', true, false, true, false],
        ['during a round without an event it goes into combat', false, true, true, true],
        ['during an event with a round it goes into combat', true, true, true, true],
    ])('a skill aimed at another player %s', (_name, hasActiveEvent, hasActiveRound, allowed, submitToCombat) => {
        const context = makeContext({ hasActiveEvent, hasActiveRound });

        const plan = planChatSkillUse(context);

        expect([plan.allowed, plan.submitToCombat]).toEqual([allowed, submitToCombat]);
    });

    it.each([
        ['outside any round it stays in chat', false, false],
        ['during a round it still stays in chat', true, false],
    ])('an other-target skill with nobody picked %s', (_name, hasActiveRound, submitToCombat) => {
        const context = makeContext({ hasSelectedTarget: false, hasActiveRound });

        const plan = planChatSkillUse(context);

        expect([plan.allowed, plan.submitToCombat]).toEqual([true, submitToCombat]);
    });

    it.each([
        ['self', true, true],
        ['any', true, true],
        ['none', true, true],
        ['self', false, false],
        ['any', false, false],
        ['none', false, false],
    ])('a %s-target skill goes into combat only when a round is active (round active: %s)', (skillTarget, hasActiveRound, submitToCombat) => {
        const context = makeContext({ skillTarget, hasSelectedTarget: false, hasActiveRound });

        const plan = planChatSkillUse(context);

        expect([plan.allowed, plan.submitToCombat]).toEqual([true, submitToCombat]);
    });

    it.each([
        ['an experience post outside combat counts the use in chat', true, false, true],
        ['an experience post sent into combat leaves the count to the combat submission', true, true, false],
        ['a post without experience outside combat counts nothing in chat', false, false, false],
        ['a post without experience sent into combat counts nothing in chat', false, true, false],
    ])('%s', (_name, grantsExperience, hasActiveRound, incrementUsageInChat) => {
        const context = makeContext({ skillTarget: 'self', hasSelectedTarget: false, grantsExperience, hasActiveRound });

        const plan = planChatSkillUse(context);

        expect(plan.incrementUsageInChat).toBe(incrementUsageInChat);
    });

    it.each([
        ['an experience post writes an engine log', true, true],
        ['a post without experience writes no engine log', false, false],
    ])('%s', (_name, grantsExperience, writeEngineLog) => {
        const context = makeContext({ skillTarget: 'self', hasSelectedTarget: false, grantsExperience });

        const plan = planChatSkillUse(context);

        expect(plan.writeEngineLog).toBe(writeEngineLog);
    });
});
