/**
 * Indexer Configuration
 *
 * Loads configuration from environment variables with sensible defaults.
 */

import type { IndexerConfig } from './types.js';

const API_BASE: Record<string, string> = {
  mainnet: 'https://api.kaspa.org',
  testnet: 'https://api-tn11.kaspa.org',
};

export function loadConfig(): IndexerConfig {
  const network = (process.env['NETWORK'] ?? 'testnet') as 'mainnet' | 'testnet';
  const databaseUrl = process.env['DATABASE_URL'] ?? '';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the indexer');
  }

  const watchAddresses = (process.env['WATCH_ADDRESSES'] ?? '')
    .split(',')
    .map(a => a.trim())
    .filter(Boolean);

  return {
    databaseUrl,
    network,
    apiBaseUrl: process.env['KASPA_API_URL'] ?? API_BASE[network] ?? API_BASE['testnet']!,
    pollIntervalMs: Number(process.env['POLL_INTERVAL_MS'] ?? 3000),
    idlePollIntervalMs: Number(process.env['IDLE_POLL_INTERVAL_MS'] ?? 30000),
    startDaaScore: Number(process.env['START_DAA_SCORE'] ?? 0),
    watchAddresses,
  };
}
