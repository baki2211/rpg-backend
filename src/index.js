import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import cookieParser from 'cookie-parser';
import http from 'http'; 
import { AppDataSource } from './data-source.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import protectedRoutes from './routes/protected.js';
import mapRoutes from './routes/map.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import locationRoutes from './routes/location.js';
import chatRoutes from './routes/chat.js';
import { setupWebSocketServer } from './websockets/ChatWebSocket.js';
import { setupPresenceWebSocketServer } from './websockets/PresenceWebSocket.js';
import raceRoutes from './routes/race.js';
import characterRoutes from './routes/character.js';
import skillRoutes from './routes/skill.js';
import skillBranchRoutes from './routes/skillBranch.js';
import skillTypeRoutes from './routes/skillType.js';
import sessionRoutes from './routes/session.js';
import characterSkillsRoutes from './routes/characterSkills.js';
import { SessionExpirationJob } from './jobs/sessionExpiration.js';

dotenv.config();

// Initialize Express and other constants
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chatWS = setupWebSocketServer();
const presenceWS = setupPresenceWebSocketServer();
const sessionExpirationInterval = SessionExpirationJob.startJob();
// Middleware for WebSocket connections

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url?.split('?')[0];

  if (pathname === '/ws/chat') {
    chatWS.handleUpgrade(req, socket, head);
  } else if (pathname === '/ws/presence') {
    presenceWS.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// Middleware
app.use(cors({origin: 'http://localhost:3000', credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'],}));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/races', raceRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/character-skills', characterSkillsRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/skill-branches', skillBranchRoutes);
app.use('/api/skill-types', skillTypeRoutes);
app.use('/api/sessions', sessionRoutes);

// Other Routes
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(errorHandler);
AppDataSource.initialize()
    .then(() => {
        console.log('App connected to the database');
        server.listen(PORT, () => {
            console.log(`App Server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error during Data Source initialization:', error);
    });
process.on('SIGTERM', () => {
  clearInterval(sessionExpirationInterval);
});