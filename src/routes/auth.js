import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { RateLimitMiddleware } from '../middleware/rateLimitMiddleware.js';
import { setCsrfCookie } from '../middleware/csrfMiddleware.js';
import { AuditLogger } from '../utils/auditLogger.js';

const router = express.Router();
const userService = new UserService();
const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to create a new token
const createToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );
};

// Host-only cookie (no `domain`), SameSite=Lax in both envs.
// `secure` is env-driven so HTTP dev still works; in prod (or any HTTPS dev
// via ngrok etc.) set NODE_ENV=production or COOKIE_SECURE=true.
const cookieIsSecure = () =>
    process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';

const setTokenCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: cookieIsSecure(),
        sameSite: 'lax',
        maxAge: 3600000, // 1 hour
    });
};

// Register route
router.post('/register', RateLimitMiddleware.authAttemptLimit, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Missing username or password' });
        return;
    }

    // Basic password validation
    if (password.length < 8) {
        res.status(400).json({ message: 'Password must be at least 8 characters long' });
        return;
    }

    // Username validation
    if (username.length < 3 || username.length > 50) {
        res.status(400).json({ message: 'Username must be between 3 and 50 characters' });
        return;
    }

    try {
        const existingUser = await userService.findByUsername(username);
        if (existingUser) {
            res.status(409).json({ message: 'Username already exists' });
            return;
        }

        const newUser = await userService.register(username, password);
        
        // Log successful registration
        AuditLogger.logAuth(
            AuditLogger.EventTypes.REGISTRATION,
            newUser.id,
            req,
            true,
            null,
            { username, user_id: newUser.id }
        );
        
        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
router.post('/login', RateLimitMiddleware.authAttemptLimit, async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await userService.findByUsername(username);
        if (!user || !user.password) {
            // Log failed login attempt
            AuditLogger.logAuth(
                AuditLogger.EventTypes.LOGIN_FAILURE,
                null,
                req,
                false,
                new Error('Invalid username or password'),
                { attempted_username: username, reason: 'user_not_found' }
            );
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        const isPasswordValid = await userService.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            // Log failed login attempt with wrong password
            AuditLogger.logAuth(
                AuditLogger.EventTypes.LOGIN_FAILURE,
                user.id,
                req,
                false,
                new Error('Invalid password'),
                { username: user.username, reason: 'invalid_password' }
            );
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        if (!JWT_SECRET) {
            res.status(500).json({ message: 'Server configuration error' });
            return;
        }

        const token = createToken(user);
        setTokenCookie(res, token);
        setCsrfCookie(res);

        // Log successful login
        AuditLogger.logAuth(
            AuditLogger.EventTypes.LOGIN_SUCCESS,
            user.id,
            req,
            true,
            null,
            { username: user.username, role: user.role }
        );

        res.status(200).json({
            message: 'Login successful!',
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Token refresh endpoint - extends valid tokens for active users
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const user = req.user; // From validated token
        
        // Check token expiration time
        const now = Math.floor(Date.now() / 1000);
        const tokenExp = user.exp;
        const timeUntilExpiration = tokenExp - now;
        
        // Only refresh if token expires within 30 minutes (1800 seconds)
        // This prevents unnecessary refreshes and limits refresh frequency
        if (timeUntilExpiration > 1800) {
            res.status(200).json({ 
                message: 'Token still fresh',
                refreshed: false
            });
            return;
        }
        
        // Create new token with fresh expiration
        const newToken = createToken(user);
        setTokenCookie(res, newToken);
        setCsrfCookie(res);
        
        // Log token refresh
        AuditLogger.logAuth(
            AuditLogger.EventTypes.TOKEN_REFRESH,
            user.id,
            req,
            true,
            null,
            { time_until_expiration: timeUntilExpiration }
        );
        
        res.status(200).json({
            message: 'Token refreshed successfully',
            refreshed: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
router.post('/logout', (req, res) => {
    // Log logout (may not have user info if token is invalid)
    const userId = req.user?.id || null;
    AuditLogger.logAuth(
        AuditLogger.EventTypes.LOGOUT,
        userId,
        req,
        true,
        null,
        { method: 'cookie_clear' }
    );
    
    // Clear the cookie if it exists. Attributes must match setTokenCookie.
    res.clearCookie('token', {
        httpOnly: true,
        secure: cookieIsSecure(),
        sameSite: 'lax',
    });
    res.clearCookie('csrfToken', {
        httpOnly: false,
        secure: cookieIsSecure(),
        sameSite: 'lax',
    });

    res.status(200).json({ message: 'Logged out successfully!' });
});

export default router;
