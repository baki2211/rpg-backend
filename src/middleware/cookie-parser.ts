import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import authRoutes, { authenticateToken } from '../routes/auth';

const app = express();

app.use(cookieParser()); // Parse cookies
app.use('/api/auth', authRoutes); // Register auth routes

// Example of a protected route
app.get('/api/protected', authenticateToken, (req: Request, res: Response) => {
    res.status(200).json({ message: `Welcome, ${(req as any).user.username}!` });
});
