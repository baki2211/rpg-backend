import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import router from './routes/home';
import { authenticateToken } from './middleware/authMiddleware';
import cookieParser from 'cookie-parser';
import { AppDataSource } from './data-source';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors({origin: 'http://localhost:3000', credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],}));
app.use(cookieParser()); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/home', router);
app.use('/api/auth', authRoutes);
app.get('/api/protected', authenticateToken, (req, res) => {
    const user = (req as any).user;
    res.status(200).json({ message: `Welcome, ${user.username}!` });
});
// Start Server
AppDataSource.initialize()
    .then(() => {
        console.log('Connected to the database!!');
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error during Data Source initialization:', error);
    });
