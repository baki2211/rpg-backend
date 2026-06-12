import crypto from 'crypto';

// Double-submit cookie CSRF protection.
//
// On login/refresh we issue a non-httpOnly `csrfToken` cookie. The SPA reads
// it and echoes the value back in the `X-CSRF-Token` header on every
// state-changing request. This middleware compares the cookie to the header
// in constant time. SameSite=Lax on the session cookie already blocks
// cross-site form POSTs — this covers the XHR/fetch case.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Bootstrap routes — clients have no csrfToken cookie yet when calling these.
const EXEMPT_PATHS = new Set([
    '/api/auth/login',
    '/api/auth/register',
]);

const cookieIsSecure = () =>
    process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';

export const setCsrfCookie = (res) => {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', token, {
        httpOnly: false, // must be readable by the SPA
        secure: cookieIsSecure(),
        sameSite: 'lax',
        maxAge: 3600000, // 1 hour — matches the session token
    });
    return token;
};

const timingSafeEqualStrings = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
};

export const verifyCsrfToken = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const path = req.originalUrl.split('?')[0];
    if (EXEMPT_PATHS.has(path)) return next();

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.headers['x-csrf-token'];

    if (!timingSafeEqualStrings(cookieToken, headerToken)) {
        res.status(403).json({ message: 'Invalid or missing CSRF token' });
        return;
    }
    next();
};
