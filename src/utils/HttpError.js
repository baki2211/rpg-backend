export class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
    }
}

// PostgreSQL SQLSTATE for a unique constraint violation
const UNIQUE_VIOLATION = '23505';

const UNIQUE_VIOLATION_MESSAGE = 'The request conflicts with an existing record';

/**
 * Decide the HTTP response for an error that reached the error handler.
 * TypeORM wraps driver errors in QueryFailedError: the SQLSTATE is on `driverError.code`
 * (and copied to `code`). The constraint name and SQL stay out of the response.
 * @param {Error & { statusCode?: number, code?: string, driverError?: { code?: string } }} err
 * @returns {{ status: number, message: string } | null} null when the error is unexpected (500)
 */
export function httpResponseForError(err) {
    if (err.statusCode) {
        return { status: err.statusCode, message: err.message };
    }
    if (err.driverError?.code === UNIQUE_VIOLATION || err.code === UNIQUE_VIOLATION) {
        return { status: 409, message: UNIQUE_VIOLATION_MESSAGE };
    }
    return null;
}
