import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { UserService } from '../services/UserService.js';

const router = Router();
const userService = new UserService();

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Register route
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Missing username or password' });
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
        console.error('Error registering user:', error);
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

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, }, JWT_SECRET, { expiresIn: '1h' });

        // Set the token as a cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set 'secure' only in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' in production, 'lax' in dev
            maxAge: 3600000, // 1 hour
        });

        res.status(200).json({ message: 'Login successful!' });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Logout route
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.status(200).json({ message: 'Logged out successfully!' });
});

// Token verification middleware
export const authenticateToken = (req, res, next) => {
    const token = req.cookies?.token; // Read the token from cookies

    if (!token) {
        res.status(401).json({ message: 'Unauthorized: Token missing' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach the decoded token to the req object
        next();
    } catch (err) {
        res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
};

export default router;
