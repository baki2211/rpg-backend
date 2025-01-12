import express, { Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import cookieParser from 'cookie-parser';
import http from 'http'; 
import { WebSocketServer, WebSocket } from 'ws';
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
import { setupWebSocketServer } from './webSocket.js';

dotenv.config();

// Initialize Express and other constants
const app: Application = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
setupWebSocketServer(server);

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

// Other Routes
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(errorHandler);
app.use((req, res, next) => {
  if (req.url.startsWith('/?locationId=')) {
    return; // Ignore WebSocket connection requests
  }
  next();
});

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
