import { Request, RequestHandler, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { query } from '../db';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Register route
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Missing username or password' });
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        if ((error as any).code === '23505') {
            res.status(409).json({ message: 'Username already exists' });
        } else {
            res.status(500).json({ message: 'Internal server error' });
        }
    }
});

// Login route
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    try {
        // Find the user in the database
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        // Verify the password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid username or password' });
            return;
        }

        // Generate a JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        // Set the token as a cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
        });

        res.status(200).json({ message: 'Login successful!' });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout route
router.post('/logout', (req: Request, res: Response): void => {
    // Clear the token cookie
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully!' });
});

// Token verification middleware
export const authenticateToken: RequestHandler = (req, res, next) => {
    const token = req.cookies?.token; // Read the token from cookies

    if (!token) {
        res.status(401).json({ message: 'Unauthorized: Token missing' });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded; // Attach the decoded token to the req object
        next();
    } catch (err) {
        res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
};

export default router;
