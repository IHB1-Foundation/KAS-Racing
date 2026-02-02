import cors from 'cors';
import express from 'express';
import { createServer } from 'http';

import sessionRoutes from './routes/session.js';
import txRoutes from './routes/tx.js';
import matchRoutes from './routes/match.js';
import { setupWebSocket } from './ws/index.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'kas-racing-server', version: '0.1.0' });
});

// API Routes
app.use('/api/session', sessionRoutes);
app.use('/api/tx', txRoutes);
app.use('/api/match', matchRoutes);

// Setup WebSocket
const io = setupWebSocket(httpServer);

export { app, httpServer, io };
