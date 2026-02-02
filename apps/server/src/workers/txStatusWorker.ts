/**
 * TX Status Worker
 *
 * Periodically polls for transaction status updates.
 * Updates DB and emits WebSocket events on changes.
 * Also tracks deposit transactions for duel matches.
 */

import { updateAllTrackableEvents } from '../services/txStatusService.js';
import { updateAllPendingDeposits } from '../services/depositTrackingService.js';

// Polling interval in milliseconds (default: 2 seconds)
const POLL_INTERVAL_MS = parseInt(process.env.TX_POLL_INTERVAL_MS ?? '2000', 10);

// Maximum interval between polls when no transactions to track (default: 30 seconds)
const IDLE_POLL_INTERVAL_MS = parseInt(process.env.TX_IDLE_POLL_INTERVAL_MS ?? '30000', 10);

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Single poll iteration
 */
async function poll(): Promise<void> {
  if (!isRunning) return;

  try {
    // Update reward event statuses
    const rewardResult = await updateAllTrackableEvents();

    // Update deposit statuses for duel matches
    const depositResult = await updateAllPendingDeposits();

    const hasActive = rewardResult.total > 0 || depositResult.matchesChecked > 0;

    if (rewardResult.total > 0) {
      console.log(`[txWorker] Rewards: ${rewardResult.total} polled, ${rewardResult.updated} updated`);
    }

    if (depositResult.matchesChecked > 0) {
      console.log(`[txWorker] Deposits: ${depositResult.matchesChecked} matches, ${depositResult.depositsUpdated} updated, ${depositResult.matchesReady} ready`);
    }

    // Schedule next poll
    // Use shorter interval if there are active transactions
    const nextInterval = hasActive ? POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
    pollTimer = setTimeout(() => { void poll(); }, nextInterval);

  } catch (error) {
    console.error('[txWorker] Poll error:', error);
    // Retry after a delay even on error
    pollTimer = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
  }
}

/**
 * Start the TX status worker
 */
export function startTxStatusWorker(): void {
  if (isRunning) {
    console.warn('[txWorker] Already running');
    return;
  }

  console.log(`[txWorker] Starting (poll interval: ${POLL_INTERVAL_MS}ms)`);
  isRunning = true;

  // Start polling
  void poll();
}

/**
 * Stop the TX status worker
 */
export function stopTxStatusWorker(): void {
  if (!isRunning) return;

  console.log('[txWorker] Stopping');
  isRunning = false;

  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

/**
 * Check if worker is running
 */
export function isTxStatusWorkerRunning(): boolean {
  return isRunning;
}
