import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import router from './routes/home';
import { authenticateToken } from './middleware/authMiddleware';
import cookieParser from 'cookie-parser';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(cookieParser()); // Required for parsing cookies in requests
app.use(bodyParser.json()); // Required for parsing JSON in requests
app.use(bodyParser.urlencoded({ extended: true })); // Required for parsing form data in requests

// Routes
app.get('/home', router);
app.use('/api/auth', authRoutes); // Register authentication routes
app.get('/api/protected', authenticateToken, (req, res) => {
    const user = (req as any).user;
    res.status(200).json({ message: `Welcome, ${user.username}!` });
});
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
