import { describe, it, expect } from 'vitest';
import { evaluatePost, chatRulesFromConstants } from '../../../src/domain/chat/messageRewards.js';

const NOW = 1_700_000_000_000;

const makePost = (overrides = {}) => ({
    length: 801,
    lastPostAt: null,
    now: NOW,
    minLength: 800,
    cooldownMs: 30000,
    ...overrides,
});

describe('chat post rewards', () => {
    it.each([
        ['an 800 character post is too short to count', 800, false],
        ['an 801 character post counts', 801, true],
    ])('%s', (_name, length, expected) => {
        const post = makePost({ length });

        const result = evaluatePost(post);

        expect(result.isValidPost).toBe(expected);
    });

    it.each([
        ['a post 29 999 ms after the previous one earns no experience', 29999, false, 0],
        ['a post 30 000 ms after the previous one earns half a point', 30000, true, 0.5],
    ])('%s', (_name, elapsedMs, grantsExperience, experienceDelta) => {
        const post = makePost({ lastPostAt: NOW - elapsedMs });

        const result = evaluatePost(post);

        expect(result).toEqual({ isValidPost: true, grantsExperience, experienceDelta });
    });

    it('a first post with enough characters earns half a point', () => {
        const post = makePost({ lastPostAt: null });

        const result = evaluatePost(post);

        expect(result).toEqual({ isValidPost: true, grantsExperience: true, experienceDelta: 0.5 });
    });

    it('a short post earns no experience even after the cooldown', () => {
        const post = makePost({ length: 800, lastPostAt: NOW - 60000 });

        const result = evaluatePost(post);

        expect(result).toEqual({ isValidPost: false, grantsExperience: false, experienceDelta: 0 });
    });

    it('uses the length and cooldown it is given instead of the usual ones', () => {
        const post = makePost({ length: 201, minLength: 200, cooldownMs: 5000, lastPostAt: NOW - 5000 });

        const result = evaluatePost(post);

        expect(result).toEqual({ isValidPost: true, grantsExperience: true, experienceDelta: 0.5 });
    });
});

describe('chat reward tunables', () => {
    it('falls back to 800 characters and 30 seconds when no constants exist', () => {
        const constants = [];

        const rules = chatRulesFromConstants(constants);

        expect(rules).toEqual({ minLength: 800, cooldownMs: 30000 });
    });

    it('reads the values stored as decimal strings in the constants', () => {
        const constants = [
            { constantKey: 'CHAT_POST_MIN_LENGTH', value: '500.0000' },
            { constantKey: 'CHAT_XP_COOLDOWN_MS', value: '60000.0000' },
            { constantKey: 'HP_SCALE', value: '10.0000' },
        ];

        const rules = chatRulesFromConstants(constants);

        expect(rules).toEqual({ minLength: 500, cooldownMs: 60000 });
    });

    it('ignores a constant whose value is not a number', () => {
        const constants = [{ constantKey: 'CHAT_XP_COOLDOWN_MS', value: 'soon' }];

        const rules = chatRulesFromConstants(constants);

        expect(rules).toEqual({ minLength: 800, cooldownMs: 30000 });
    });
});
