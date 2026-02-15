import { config } from "./config.js";
import { ensureTables, closePool } from "./store.js";
import { startWatcher } from "./watcher.js";
import { createServer, type Server } from "node:http";

function startHealthServer(): {
  server: Server;
  setReady: (ready: boolean) => void;
} {
  const port = Number(process.env.PORT || "8080");
  let ready = false;

  const server = createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/health" || url === "/api/health") {
      res.statusCode = ready ? 200 : 503;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: ready, service: "indexer-evm" }));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  server.listen(port, () => {
    console.log(`[health] listening on :${port}`);
  });

  return {
    server,
    setReady: (value: boolean) => {
      ready = value;
    },
  };
}

async function main() {
  console.log("=== KAS Racing EVM Indexer ===");
  console.log("Chain:", config.chainId);
  console.log("RPC:", config.rpcUrl);
  const { server: healthServer, setReady } = startHealthServer();

  // Validate config
  if (config.escrowAddress === "0x_TO_BE_DEPLOYED" && config.rewardAddress === "0x_TO_BE_DEPLOYED") {
    console.warn("[WARN] No contract addresses configured. Set ESCROW_CONTRACT_ADDRESS and/or REWARD_CONTRACT_ADDRESS.");
    console.warn("[WARN] Indexer will start but not index any events until addresses are set.");
  }

  // Ensure database tables
  try {
    await ensureTables();
    console.log("[db] Tables ensured");
  } catch (err) {
    console.error("[db] Failed to ensure tables:", err);
    console.error("[db] Make sure DATABASE_URL is set and Postgres is running.");
    process.exit(1);
  }

  // Start the event watcher
  await startWatcher();
  setReady(true);
  console.log("[health] indexer ready");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[shutdown] Closing...");
    await new Promise<void>((resolve) => {
      healthServer.close(() => resolve());
    });
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
