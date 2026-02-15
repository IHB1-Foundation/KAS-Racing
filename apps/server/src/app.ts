import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import v3Routes from './routes/v3/index.js';
import { setupWebSocket } from './ws/index.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();
const httpServer = createServer(app);

// CORS Configuration
// In production, restrict to specific origins
const rawCorsOrigin = process.env.CORS_ORIGIN?.trim();
const fallbackCorsOrigin =
  process.env.NODE_ENV === 'production' ? 'https://kasracing.ihb1.xyz' : '';
const parsedCorsOrigins =
  rawCorsOrigin && rawCorsOrigin.length > 0
    ? rawCorsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : fallbackCorsOrigin
      ? [fallbackCorsOrigin]
      : [];

const corsOptions = {
  origin:
    parsedCorsOrigins.length === 0
      ? true
      : parsedCorsOrigins.length === 1
        ? parsedCorsOrigins[0]
        : parsedCorsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // Limit body size to prevent abuse

// Skip logging and rate limiting in test environment
const isTestEnv = process.env.NODE_ENV === 'test';

// Request logging
if (!isTestEnv) {
  app.use(requestLogger);
}

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
    const ip = ipKeyGenerator(req.ip ?? 'unknown');
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

// Apply rate limiters in non-test environments
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
  app.post('/api/v3/session/event', sessionEventLimiter);
  // Match routes with betting-specific limiter
  app.use('/api/v3/match', matchLimiter);
}
app.use('/api/v3', v3Routes);

// Setup WebSocket
const io = setupWebSocket(httpServer);

export { app, httpServer, io };
