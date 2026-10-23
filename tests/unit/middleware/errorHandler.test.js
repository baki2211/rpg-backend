import { describe, it, expect } from 'vitest';
import { errorHandler } from '../../../src/middleware/errorHandler.js';

// Plain stand-ins for Express's req/res: the handler only reads method/url and writes status + JSON
const makeRequest = () => ({ method: 'GET', originalUrl: '/api/wiki/admin/entries/1' });

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const makeQueryFailedError = () => Object.assign(new Error('value "99999999999" is out of range for type integer'), {
  name: 'QueryFailedError',
  code: '22003',
  driverError: { code: '22003' },
  query: 'SELECT "WikiEntry"."id" FROM "wiki_entries" "WikiEntry" WHERE "WikiEntry"."id" = $1',
});

describe('an unexpected error reaching the error handler', () => {
  it.each([
    ['a database error carrying the SQL', makeQueryFailedError()],
    ['a programming error', new TypeError("Cannot read properties of undefined (reading 'id')")],
  ])('%s answers 500 with only a generic message', (_name, err) => {
    const res = makeResponse();

    errorHandler(err, makeRequest(), res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: 'Internal Server Error' });
  });
});
