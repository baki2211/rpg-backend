import { describe, it, expect } from 'vitest';
import { InputValidator } from '../../../src/utils/inputValidator.js';

const failure = (message) => expect.objectContaining({ name: 'HttpError', statusCode: 400, message });

describe('rejected input is a 400 with the validation message', () => {
    it.each([
        ['a round id that is not a number', () => InputValidator.validateRoundId('abc'), 'Value must be a valid integer'],
        ['a round id of zero', () => InputValidator.validateRoundId(0), 'Value must be at least 1'],
        ['a skill id one past the PostgreSQL integer limit', () => InputValidator.validateSkillId(2147483648), 'Value must be at most 2147483647'],
        ['a missing character id', () => InputValidator.validateCharacterId(undefined), 'Integer value is required'],
        ['a one-letter character name', () => InputValidator.validateCharacterName('A'), 'Character name must be at least 2 characters long'],
        ['a character name with symbols', () => InputValidator.validateCharacterName('Bad$Name'), 'Character name contains invalid characters'],
        ['a chat message of only spaces', () => InputValidator.validateChatMessage('   '), 'Message cannot be empty'],
        ['an email without a domain', () => InputValidator.validateEmail('player@'), 'Invalid email format'],
        ['a string over its maximum length', () => InputValidator.sanitizeString('abcd', { maxLength: 3 }), 'Input exceeds maximum length of 3 characters'],
        ['character stats that are not JSON', () => InputValidator.validateCharacterCreation({ name: 'Hero', stats: '{oops' }), 'Invalid stats format'],
    ])('%s', (_name, validate, message) => {
        expect(validate).toThrow(failure(message));
    });

    it.each([
        ['a missing required field', { characterId: 2, skillId: 3 }, "Validation error for field 'roundId': roundId is required"],
        ['a field that is not an integer', { roundId: 1, characterId: 2, skillId: 'fireball' }, "Validation error for field 'skillId': Value must be a valid integer"],
    ])('a combat action with %s names the field', (_name, actionData, message) => {
        expect(() => InputValidator.validateCombatAction(actionData)).toThrow(failure(message));
    });

    it('a failing custom field validator is still a 400 naming the field', () => {
        expect(() => InputValidator.validateCharacterCreation({ name: 'Hero', race: {} }))
            .toThrow(failure("Validation error for field 'race': Race ID is required"));
    });
});

describe('accepted input', () => {
    it.each([
        ['a numeric string', '42', 42],
        ['the smallest id', 1, 1],
        ['the PostgreSQL integer limit', 2147483647, 2147483647],
    ])('a round id given as %s is returned as a number', (_name, input, expected) => {
        const result = InputValidator.validateRoundId(input);

        expect(result).toBe(expected);
    });
});

describe('a row id', () => {
    it.each([
        ['zero', 0, 'Value must be at least 1'],
        ['negative', '-3', 'Value must be at least 1'],
        ['one past the PostgreSQL integer limit', '2147483648', 'Value must be at most 2147483647'],
        ['far past the PostgreSQL integer limit', '99999999999', 'Value must be at most 2147483647'],
        ['a word', 'abc', 'Value must be a valid integer'],
        ['a decimal', '1.5', 'Value must be a valid integer'],
        ['a number followed by letters', '12abc', 'Value must be a valid integer'],
        ['a hexadecimal string', '0x10', 'Value must be a valid integer'],
        ['an exponent string', '1e3', 'Value must be a valid integer'],
        ['a number with a leading space', ' 7', 'Value must be a valid integer'],
        ['a number with a trailing space', '7 ', 'Value must be a valid integer'],
        ['an empty string', '', 'Value must be a valid integer'],
        ['a boolean', true, 'Value must be a valid integer'],
        ['an array holding a number', [7], 'Value must be a valid integer'],
        ['an object', { id: 7 }, 'Value must be a valid integer'],
        ['a decimal number', 1.5, 'Value must be a valid integer'],
        ['missing', undefined, 'Integer value is required'],
    ])('that is %s is a 400', (_name, input, message) => {
        expect(() => InputValidator.validateId(input)).toThrow(failure(message));
    });

    it.each([
        ['the smallest id', '1', 1],
        ['the PostgreSQL integer limit', '2147483647', 2147483647],
        ['a digit string', '7', 7],
        ['a number', 7, 7],
    ])('given as %s is returned as a number', (_name, input, expected) => {
        const result = InputValidator.validateId(input);

        expect(result).toBe(expected);
    });
});

describe('an integer with a negative lower bound', () => {
    it.each([
        ['a negative digit string inside the bound', '-3', -3],
        ['a negative number on the bound', -5, -5],
    ])('accepts %s', (_name, input, expected) => {
        const result = InputValidator.validateInteger(input, { min: -5 });

        expect(result).toBe(expected);
    });

    it('rejects a negative digit string just past the bound', () => {
        expect(() => InputValidator.validateInteger('-6', { min: -5 })).toThrow(failure('Value must be at least -5'));
    });
});
