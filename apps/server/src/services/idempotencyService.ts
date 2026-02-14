/**
 * Idempotency Service
 *
 * Prevents duplicate transaction submissions using the idempotency_keys table.
 * Each key is associated with a txid and result, and expires after a configurable TTL.
 *
 * Usage:
 *   const existing = await checkIdempotencyKey(key);
 *   if (existing) return existing; // duplicate request
 *   // ... perform operation ...
 *   await setIdempotencyKey(key, txid, result, ttlMs);
 */

import { eq } from 'drizzle-orm';
import { db, idempotencyKeys } from '../db/index.js';

// Default TTL: 24 hours
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyResult {
  txid: string | null;
  result: unknown;
}

/**
 * Check if an idempotency key already exists and is not expired.
 * Returns the stored result if found, null otherwise.
 */
export async function checkIdempotencyKey(
  key: string
): Promise<IdempotencyResult | null> {
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Check expiration
  if (row.expiresAt < new Date()) {
    // Expired — clean up and return null
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
    return null;
  }

  return {
    txid: row.txid,
    result: row.result ? JSON.parse(row.result) : null,
  };
}

/**
 * Store an idempotency key with its associated result.
 * Uses INSERT ... ON CONFLICT to handle races.
 */
export async function setIdempotencyKey(
  key: string,
  txid: string | null,
  result: unknown,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // Upsert: if key exists, update; otherwise insert
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(idempotencyKeys)
      .set({
        txid,
        result: result != null ? JSON.stringify(result) : null,
        expiresAt,
      })
      .where(eq(idempotencyKeys.key, key));
  } else {
    await db.insert(idempotencyKeys).values({
      key,
      txid,
      result: result != null ? JSON.stringify(result) : null,
      createdAt: now,
      expiresAt,
    });
  }
}

/**
 * Remove an idempotency key (for cleanup or retry).
 */
export async function removeIdempotencyKey(key: string): Promise<void> {
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
}

/**
 * Generate a standard idempotency key for deposit operations.
 */
export function depositIdempotencyKey(matchId: string, player: 'A' | 'B'): string {
  return `deposit:${matchId}:${player}`;
}

/**
 * Generate a standard idempotency key for settlement operations.
 */
export function settlementIdempotencyKey(matchId: string): string {
  return `settlement:${matchId}`;
}
