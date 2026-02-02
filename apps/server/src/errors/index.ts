/**
 * Standardized Error Codes for KAS Racing API
 *
 * All API errors should use these codes for consistent client handling.
 */

export enum ErrorCode {
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Validation
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',

  // Session
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_ENDED = 'SESSION_ENDED',
  SESSION_INVALID = 'SESSION_INVALID',

  // Policy
  COOLDOWN_ACTIVE = 'COOLDOWN_ACTIVE',
  MAX_EVENTS_REACHED = 'MAX_EVENTS_REACHED',
  TIMESTAMP_INVALID = 'TIMESTAMP_INVALID',

  // Match
  MATCH_NOT_FOUND = 'MATCH_NOT_FOUND',
  MATCH_FULL = 'MATCH_FULL',
  MATCH_NOT_READY = 'MATCH_NOT_READY',
  MATCH_ALREADY_STARTED = 'MATCH_ALREADY_STARTED',
  MATCH_ALREADY_FINISHED = 'MATCH_ALREADY_FINISHED',
  INVALID_JOIN_CODE = 'INVALID_JOIN_CODE',
  CANNOT_JOIN_OWN_MATCH = 'CANNOT_JOIN_OWN_MATCH',

  // Transaction
  TX_NOT_FOUND = 'TX_NOT_FOUND',
  TX_BROADCAST_FAILED = 'TX_BROADCAST_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',

  // Server
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
}

/**
 * API Error Response structure
 */
export interface ApiError {
  error: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryAfterMs?: number;
}

/**
 * Create a standardized API error response
 */
export function createApiError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return {
    error: code,
    message,
    ...(details && { details }),
  };
}

/**
 * Human-readable error messages
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',
  [ErrorCode.INVALID_REQUEST]: 'Invalid request format.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required field is missing.',
  [ErrorCode.INVALID_ADDRESS]: 'Invalid Kaspa address format.',
  [ErrorCode.INVALID_AMOUNT]: 'Invalid amount specified.',
  [ErrorCode.SESSION_NOT_FOUND]: 'Session not found.',
  [ErrorCode.SESSION_ENDED]: 'Session has already ended.',
  [ErrorCode.SESSION_INVALID]: 'Invalid session state.',
  [ErrorCode.COOLDOWN_ACTIVE]: 'Event cooldown is active. Please wait.',
  [ErrorCode.MAX_EVENTS_REACHED]: 'Maximum events per session reached.',
  [ErrorCode.TIMESTAMP_INVALID]: 'Event timestamp is invalid.',
  [ErrorCode.MATCH_NOT_FOUND]: 'Match not found.',
  [ErrorCode.MATCH_FULL]: 'Match is already full.',
  [ErrorCode.MATCH_NOT_READY]: 'Match is not ready to start.',
  [ErrorCode.MATCH_ALREADY_STARTED]: 'Match has already started.',
  [ErrorCode.MATCH_ALREADY_FINISHED]: 'Match has already finished.',
  [ErrorCode.INVALID_JOIN_CODE]: 'Invalid join code.',
  [ErrorCode.CANNOT_JOIN_OWN_MATCH]: 'Cannot join your own match.',
  [ErrorCode.TX_NOT_FOUND]: 'Transaction not found.',
  [ErrorCode.TX_BROADCAST_FAILED]: 'Failed to broadcast transaction.',
  [ErrorCode.INSUFFICIENT_FUNDS]: 'Insufficient funds in treasury.',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error.',
  [ErrorCode.CONFIG_ERROR]: 'Server configuration error.',
};
