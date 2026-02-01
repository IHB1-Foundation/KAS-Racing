import { app, httpServer, io } from './app.js';

// Start server only when running directly (not imported for tests)
const port = Number(process.env.PORT ?? 8787);

console.log('[server] WebSocket server initialized');
httpServer.listen(port, () => {
  console.log(`[server] HTTP listening on http://localhost:${port}`);
  console.log(`[server] WebSocket path: /ws`);
});

export { app, httpServer, io };
