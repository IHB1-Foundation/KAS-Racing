import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

import sessionRoutes from './routes/session.js';
import txRoutes from './routes/tx.js';
import matchRoutes from './routes/match.js';
import { setupWebSocket } from './ws/index.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Trust proxy (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

/**
 * Rate Limiting Configuration
 *
 * - General API: 100 requests per minute per IP
 * - Session events: 30 requests per minute per IP (stricter for game events)
 * - Match operations: 20 requests per minute per IP (stricter for betting)
 */

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    retryAfterMs: 60000,
  },
});

// Stricter rate limit for session events (game actions)
const sessionEventLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many game events. Please slow down.',
    retryAfterMs: 60000,
  },
  keyGenerator: (req) => {
    // Combine IP with session ID for per-session rate limiting
    const sessionId = (req.body as { sessionId?: string })?.sessionId || 'unknown';
    const ip = req.ip || 'unknown';
    return `${ip}:${sessionId}`;
  },
});

// Rate limit for match operations (betting)
const matchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many match operations. Please try again later.',
    retryAfterMs: 60000,
  },
});

// Apply rate limiters only in non-test environments
const isTestEnv = process.env.NODE_ENV === 'test';

if (!isTestEnv) {
  // Apply general limiter to all API routes
  app.use('/api', generalLimiter);
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'kas-racing-server', version: '0.1.0' });
});

// API Routes with specific rate limiters
if (!isTestEnv) {
  // Session routes with event-specific limiter
  app.post('/api/session/event', sessionEventLimiter);
  // Match routes with betting-specific limiter
  app.use('/api/match', matchLimiter);
}

app.use('/api/session', sessionRoutes);
app.use('/api/tx', txRoutes);
app.use('/api/match', matchRoutes);

// Setup WebSocket
const io = setupWebSocket(httpServer);

export { app, httpServer, io };
