import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { authenticateToken } from './middleware/authMiddleware';
import authRoutes from './routes/auth';
import router from './routes/players';
import { getPlayers } from './controllers/playerController';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
router.get('/', authenticateToken, getPlayers);
app.use('/api/auth', authRoutes);


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
