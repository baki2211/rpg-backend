import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import cookieParser from 'cookie-parser';
import { AppDataSource } from './data-source.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import protectedRoutes from './routes/protected.js';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/protected', protectedRoutes);

AppDataSource.initialize()
    .then(() => {
        console.log('Connected to the database');
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error during Data Source initialization:', error);
    });
