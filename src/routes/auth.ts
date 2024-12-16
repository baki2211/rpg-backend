import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, Router } from 'express';

const router: Router = express.Router();

// In-memory user storage (replace this with a database later)
const users: { id: number; username: string; password: string }[] = [];

// Secret key for JWT (store in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';

// User registration
router.post('/register', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Missing username or password' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = { id: users.length + 1, username, password: hashedPassword };
    users.push(user);

    res.status(201).json({ message: 'User registered successfully' });
});

// User login
router.post('/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;

    const user = users.find((u) => u.username === username);
    if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
});

// Verify token
router.get('/verify', (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Missing token' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ decoded });
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
});

export default router;
