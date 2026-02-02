import { app, httpServer, io } from './app.js';
import { getConfig, safeLogConfig, resetConfigCache } from './config/index.js';
import { startTxStatusWorker } from './workers/txStatusWorker.js';

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

// Start server
const port = Number(process.env.PORT ?? 8787);

console.log('[server] WebSocket server initialized');
httpServer.listen(port, () => {
  console.log(`[server] HTTP listening on http://localhost:${port}`);
  console.log(`[server] WebSocket path: /ws`);

  // Start TX status worker (only if not skipping key validation)
  if (!skipKeyValidation) {
    startTxStatusWorker();
  } else {
    console.log('[server] TX status worker skipped (SKIP_KEY_VALIDATION=true)');
  }
});

export { app, httpServer, io };
