import cors from 'cors';
import express from 'express';
import { createServer } from 'http';

import sessionRoutes from './routes/session.js';
import txRoutes from './routes/tx.js';
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

// Setup WebSocket
const io = setupWebSocket(httpServer);
console.log('[server] WebSocket server initialized');

// Start server
const port = Number(process.env.PORT ?? 8787);
httpServer.listen(port, () => {
  console.log(`[server] HTTP listening on http://localhost:${port}`);
  console.log(`[server] WebSocket path: /ws`);
});

export { app, httpServer, io };
