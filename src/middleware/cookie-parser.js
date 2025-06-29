import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../routes/auth.js';
import { authenticateToken } from './authMiddleware.js';

const app = express();

app.use(cookieParser()); // Parse cookies
app.use('/api/auth', authRoutes); // Register auth routes

// Example of a protected route
app.get('/api/protected', authenticateToken, (req, res) => {
    res.status(200).json({ message: `Welcome, ${(req).user.username}!` });
});
