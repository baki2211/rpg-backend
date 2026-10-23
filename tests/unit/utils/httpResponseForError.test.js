import { describe, it, expect } from 'vitest';
import { HttpError, httpResponseForError } from '../../../src/utils/HttpError.js';

// Plain objects shaped like what reaches the error handler (TypeORM QueryFailedError, pg errors)
const makeQueryFailedError = (code, fields = {}) => Object.assign(new Error('duplicate key value violates unique constraint "IDX_COMBAT_ACTION_UNIQUE_PER_ROUND"'), {
    name: 'QueryFailedError',
    code,
    driverError: { code, constraint: 'IDX_COMBAT_ACTION_UNIQUE_PER_ROUND', detail: 'Key ("roundId", "characterId")=(1, 2) already exists.' },
    query: 'INSERT INTO "combat_actions" ...',
    ...fields,
});

describe('HTTP response for an error reaching the error handler', () => {
    it('an error carrying a status keeps that status and its message', () => {
        const err = new HttpError(404, 'Character not found');

        const result = httpResponseForError(err);

        expect(result).toEqual({ status: 404, message: 'Character not found' });
    });

    it.each([
        ['on the wrapped driver error and the query error', makeQueryFailedError('23505')],
        ['only on the wrapped driver error', makeQueryFailedError('23505', { code: undefined })],
        ['only on the error itself', { message: 'duplicate key', code: '23505' }],
    ])('a unique violation reported %s is a 409 without the constraint or SQL', (_name, err) => {
        const result = httpResponseForError(err);

        expect(result).toEqual({ status: 409, message: 'The request conflicts with an existing record' });
    });

    it.each([
        ['a foreign key violation', makeQueryFailedError('23503')],
        ['a not-null violation', makeQueryFailedError('23502')],
        ['a programming error', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ])('%s is unexpected and left to the 500 path', (_name, err) => {
        const result = httpResponseForError(err);

        expect(result).toBeNull();
    });
});
