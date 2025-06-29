import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

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

// Helper function to set token cookie
const setTokenCookie = (res, token) => {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 3600000, // 1 hour
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
    };
    res.cookie('token', token, cookieOptions);
};

// Register route
router.post('/register', async (req, res) => {
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
        res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await userService.findByUsername(username);
        if (!user || !user.password) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        const isPasswordValid = await userService.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        if (!JWT_SECRET) {
            res.status(500).json({ message: 'Server configuration error' });
            return;
        }

        const token = createToken(user);
        setTokenCookie(res, token);

        // ALSO return the token in response body for cross-domain compatibility
        res.status(200).json({ 
            message: 'Login successful!',
            token: token,
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
        
        res.status(200).json({ 
            message: 'Token refreshed successfully',
            token: newToken,
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
    // Clear the cookie if it exists
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
    });

    // Also clear any Authorization header
    res.set('Authorization', '');

    res.status(200).json({ message: 'Logged out successfully!' });
});

export default router;
