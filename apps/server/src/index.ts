import { app, httpServer, io } from './app.js';
import { getConfig, safeLogConfig, resetConfigCache } from './config/index.js';
import { startTxStatusWorker } from './workers/txStatusWorker.js';
import { initPayloadSeed } from './payload/index.js';

// Validate configuration on startup (unless explicitly skipped for development)
const skipKeyValidation = process.env.SKIP_KEY_VALIDATION === 'true';

if (!skipKeyValidation) {
  try {
    const config = getConfig();
    console.log('[server] Configuration loaded:', safeLogConfig(config));
  } catch (error) {
    console.error('[server] FATAL: Configuration error');
    console.error((error as Error).message);
    console.error('[server] Set SKIP_KEY_VALIDATION=true to skip (development only)');
    process.exit(1);
  }
} else {
  console.warn('[server] WARNING: Key validation skipped (SKIP_KEY_VALIDATION=true)');
  console.warn('[server] Reward payouts and duel settlements will NOT work!');
  resetConfigCache();
}

// Initialize payload seed for Proof-of-Action
// Seed is randomly generated on each server start
// In production, consider loading from persistent secure storage
initPayloadSeed();
console.log('[server] Payload seed initialized for Proof-of-Action');

// Start server
const port = Number(process.env.PORT ?? 8787);

console.log('[server] WebSocket server initialized');
httpServer.listen(port, () => {
  console.log(`[server] HTTP listening on http://localhost:${port}`);
  console.log(`[server] WebSocket path: /ws`);

  // Start TX status worker (always start for status tracking)
  startTxStatusWorker();
});

export { app, httpServer, io };
