import { config } from "./config.js";
import { ensureTables, closePool } from "./store.js";
import { startWatcher } from "./watcher.js";

async function main() {
  console.log("=== KAS Racing EVM Indexer ===");
  console.log("Chain:", config.chainId);
  console.log("RPC:", config.rpcUrl);

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

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[shutdown] Closing...");
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
