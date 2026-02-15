/**
 * KAS Racing Chain Indexer
 *
 * Watches Kaspa addresses for escrow-related transactions and records
 * chain events in Postgres.
 *
 * Architecture:
 *   - Custom polling indexer (Ponder not compatible with non-EVM Kaspa)
 *   - UTXO-based detection: watches escrow/treasury addresses
 *   - DAA score ordering (Kaspa DAG, not linear blocks)
 *   - Idempotent writes via UNIQUE(txid, to_address)
 *
 * Recovery:
 *   - Restart-safe: loads last processed state from indexer_state table
 *   - Backfill: set START_DAA_SCORE to re-index from a specific point
 *   - Chain reorg: UTXO-based (no block reorg handling needed for DAG)
 */

import 'dotenv/config';
import { loadConfig } from './config.js';
import { IndexerStore } from './store.js';
import { ChainWatcher } from './watcher.js';

export { IndexerStore } from './store.js';
export { ChainWatcher } from './watcher.js';
export { loadConfig } from './config.js';
export type { ChainEvent, IndexerState, IndexerConfig } from './types.js';

async function main(): Promise<void> {
  console.log('[indexer] KAS Racing Chain Indexer starting...');

  const config = loadConfig();
  console.log(`[indexer] Network: ${config.network}`);
  console.log(`[indexer] API: ${config.apiBaseUrl}`);
  console.log(`[indexer] Watch addresses: ${config.watchAddresses.length}`);

  const store = new IndexerStore(config.databaseUrl);

  // Ensure schema exists
  console.log('[indexer] Ensuring database schema...');
  await store.ensureSchema();

  // Get last state
  const state = await store.getState();
  console.log(`[indexer] Last processed DAA score: ${state.lastProcessedDaaScore}`);
  console.log(`[indexer] Total events processed: ${state.eventsProcessed}`);

  // Start watcher
  const watcher = new ChainWatcher(config, store);
  await watcher.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[indexer] Shutting down...');
    watcher.stop();
    await store.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  console.log('[indexer] Indexer running. Press Ctrl+C to stop.');
}

// Only run main() when executed directly (not imported)
const isDirectRun = process.argv[1]?.endsWith('index.ts') ||
                     process.argv[1]?.endsWith('index.js');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[indexer] Fatal error:', err);
    process.exit(1);
  });
}
