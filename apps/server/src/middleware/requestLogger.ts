/**
 * Request Logger Middleware
 *
 * Adds structured logging with request correlation IDs.
 * Enables tracking requests through the system for debugging.
 */

import { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request to include requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Extract session/match IDs from request for correlation
 */
function extractCorrelationIds(req: Request): {
  sessionId?: string;
  matchId?: string;
} {
  // From URL params
  const sessionId = req.params.sessionId;
  const matchId = req.params.matchId || req.params.id;

  // From body
  const body = req.body as { sessionId?: string; matchId?: string } | undefined;
  const bodySessionId = body?.sessionId;
  const bodyMatchId = body?.matchId;

  return {
    sessionId: sessionId || bodySessionId,
    matchId: matchId || bodyMatchId,
  };
}

/**
 * Format log message with structured data
 */
function formatLog(data: Record<string, unknown>): string {
  return JSON.stringify(data);
}

/**
 * Request logger middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.requestId = randomUUID().slice(0, 8); // Short ID for readability
  req.startTime = Date.now();

  // Log incoming request
  const correlation = extractCorrelationIds(req);
  const requestLog = {
    type: 'request',
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    ...(correlation.sessionId && { sessionId: correlation.sessionId }),
    ...(correlation.matchId && { matchId: correlation.matchId }),
    timestamp: new Date().toISOString(),
  };

  console.log(`[request] ${formatLog(requestLog)}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    const responseLog = {
      type: 'response',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ...(correlation.sessionId && { sessionId: correlation.sessionId }),
      ...(correlation.matchId && { matchId: correlation.matchId }),
      timestamp: new Date().toISOString(),
    };

    // Log with appropriate level based on status
    if (res.statusCode >= 500) {
      console.error(`[response] ${formatLog(responseLog)}`);
    } else if (res.statusCode >= 400) {
      console.warn(`[response] ${formatLog(responseLog)}`);
    } else {
      console.log(`[response] ${formatLog(responseLog)}`);
    }
  });

  next();
}

/**
 * Log a transaction event with correlation
 */
export function logTxEvent(
  eventType: 'broadcast' | 'accepted' | 'included' | 'confirmed' | 'failed',
  data: {
    txid: string;
    sessionId?: string;
    matchId?: string;
    requestId?: string;
    error?: string;
    durationMs?: number;
  }
): void {
  const log = {
    type: 'tx',
    event: eventType,
    txid: data.txid,
    ...(data.sessionId && { sessionId: data.sessionId }),
    ...(data.matchId && { matchId: data.matchId }),
    ...(data.requestId && { requestId: data.requestId }),
    ...(data.error && { error: data.error }),
    ...(data.durationMs && { durationMs: data.durationMs }),
    timestamp: new Date().toISOString(),
  };

  if (eventType === 'failed') {
    console.error(`[tx] ${formatLog(log)}`);
  } else {
    console.log(`[tx] ${formatLog(log)}`);
  }
}

/**
 * Log a game event with correlation
 */
export function logGameEvent(
  eventType: 'session_start' | 'session_end' | 'checkpoint' | 'match_create' | 'match_join' | 'match_finish',
  data: {
    sessionId?: string;
    matchId?: string;
    requestId?: string;
    userAddress?: string;
    details?: Record<string, unknown>;
  }
): void {
  const log = {
    type: 'game',
    event: eventType,
    ...(data.sessionId && { sessionId: data.sessionId }),
    ...(data.matchId && { matchId: data.matchId }),
    ...(data.requestId && { requestId: data.requestId }),
    ...(data.userAddress && { userAddress: data.userAddress.slice(0, 20) + '...' }),
    ...(data.details && { details: data.details }),
    timestamp: new Date().toISOString(),
  };

  console.log(`[game] ${formatLog(log)}`);
}
