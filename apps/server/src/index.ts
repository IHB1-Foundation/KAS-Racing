import 'dotenv/config';
import { app, httpServer, io } from './app.js';
import { startEvmEventBridge } from './workers/evmEventBridge.js';
import { initPayloadSeed } from './payload/index.js';

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

  // Start EVM event bridge (chain_events_evm → WS + v3 tables)
  void startEvmEventBridge();
});

export { app, httpServer, io };
