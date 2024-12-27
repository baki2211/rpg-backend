import { Request, RequestHandler, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = Router();

const users: { id: number; username: string; password: string }[] = []; // In-memory user store

const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// Register route
router.post('/register', async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ message: 'Missing username or password' });
        return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = { id: users.length + 1, username, password: hashedPassword };
    users.push(newUser);

    res.status(201).json({ message: 'User registered successfully' });
});

// Login route
router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    // Find the user in the in-memory store
    const user = users.find((u) => u.username === username);
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

    // Set the token as an httpOnly cookie
    res.cookie('token', token, {
        httpOnly: true, // Prevents JavaScript access
        secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
        sameSite: 'strict', // CSRF protection
        maxAge: 3600000, // 1 hour
    });

    res.status(200).json({ message: 'Login successful!' });
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