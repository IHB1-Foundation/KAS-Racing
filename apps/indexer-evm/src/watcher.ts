import { createPublicClient, http, encodeEventTopics, parseAbiItem, type Log, type Address } from "viem";
import { config } from "./config.js";
import { matchEscrowAbi, rewardVaultAbi } from "./abis.js";
import { getCursor, setCursor, insertEvent, handleReorg } from "./store.js";

// Define the custom chain for viem
const kasplexTestnet = {
  id: config.chainId,
  name: "KASPLEX zkEVM Testnet",
  nativeCurrency: { name: "KAS", symbol: "KAS", decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
} as const;

export function createClient() {
  return createPublicClient({
    chain: kasplexTestnet,
    transport: http(config.rpcUrl),
  });
}

/// Fetch and index events from fromBlock to toBlock
async function indexRange(
  client: ReturnType<typeof createClient>,
  fromBlock: bigint,
  toBlock: bigint
): Promise<number> {
  let totalEvents = 0;

  type AbiEventInput = {
    type: string;
    indexed?: boolean;
    name?: string;
  };
  type AbiEvent = {
    type: "event";
    name: string;
    inputs: AbiEventInput[];
  };
  type AbiItem = AbiEvent | { type: string; name?: string; inputs?: AbiEventInput[] };

  const contracts: Array<{
    address: Address;
    abi: readonly AbiItem[];
    label: string;
  }> = [];

  if (config.escrowAddress !== "0x_TO_BE_DEPLOYED") {
    contracts.push({
      address: config.escrowAddress as Address,
      abi: matchEscrowAbi,
      label: "MatchEscrow",
    });
  }

  if (config.rewardAddress !== "0x_TO_BE_DEPLOYED") {
    contracts.push({
      address: config.rewardAddress as Address,
      abi: rewardVaultAbi,
      label: "RewardVault",
    });
  }

  for (const contract of contracts) {
    try {
      const logs = await client.getLogs({
        address: contract.address,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const eventName = decodeEventName(log, contract.abi);
        const args = decodeEventArgs(log);

        const inserted = await insertEvent({
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          contract: contract.label,
          eventName: eventName || "Unknown",
          args: args || {},
        });

        if (inserted) totalEvents++;
      }
    } catch (err) {
      console.error(`[watcher] Error fetching logs for ${contract.label}:`, err);
    }
  }

  return totalEvents;
}

/// Decode event name from log topic
function decodeEventName(
  log: Log,
  abi: readonly Array<{ type: string; name?: string; inputs?: Array<{ type: string; indexed?: boolean; name?: string }> }>
): string | null {
  const topic0 = log.topics[0];
  if (!topic0) return null;

  for (const item of abi) {
    if (item.type !== "event" || !item.name || !item.inputs) continue;
    try {
      const sig = `event ${item.name}(${item.inputs
        .map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name ?? ""}`.trim())
        .join(", ")})`;
      const abiItem = parseAbiItem(sig);
      const topics = encodeEventTopics({ abi: [abiItem] });
      if (topics[0] === topic0) return item.name;
    } catch {
      // skip malformed
    }
  }
  return topic0.slice(0, 10);
}

/// Decode event args (simplified — returns raw topics/data)
function decodeEventArgs(log: Log): Record<string, unknown> {
  return {
    topics: log.topics,
    data: log.data,
    blockNumber: (log.blockNumber ?? 0n).toString(),
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  };
}

/// Main polling loop
export async function startWatcher(): Promise<void> {
  const client = createClient();

  console.log("[watcher] Starting EVM event watcher");
  console.log("[watcher] RPC:", config.rpcUrl);
  console.log("[watcher] Chain ID:", config.chainId);
  console.log("[watcher] Escrow:", config.escrowAddress);
  console.log("[watcher] Reward:", config.rewardAddress);
  console.log("[watcher] Polling interval:", config.pollingIntervalMs, "ms");

  let cursor = await getCursor();
  if (cursor < config.startBlock) {
    cursor = config.startBlock;
  }
  console.log("[watcher] Starting from block:", cursor.toString());

  const poll = async () => {
    try {
      const latestBlock = await client.getBlockNumber();
      const safeBlock = latestBlock - BigInt(config.reorgDepth);

      // Handle potential reorgs
      if (cursor > safeBlock) {
        const deleted = await handleReorg(safeBlock);
        if (deleted > 0) {
          console.log(`[watcher] Reorg detected: removed ${deleted} events, rewinding to block ${safeBlock}`);
          cursor = safeBlock;
        }
      }

      if (cursor >= latestBlock) {
        return; // caught up
      }

      // Process in batches
      const fromBlock = cursor + 1n;
      const toBlock = fromBlock + BigInt(config.batchSize) - 1n < latestBlock
        ? fromBlock + BigInt(config.batchSize) - 1n
        : latestBlock;

      const events = await indexRange(client, fromBlock, toBlock);
      await setCursor(toBlock);
      cursor = toBlock;

      if (events > 0) {
        console.log(`[watcher] Indexed ${events} events in blocks ${fromBlock}–${toBlock}`);
      }
    } catch (err) {
      console.error("[watcher] Poll error:", err);
    }
  };

  // Initial poll (non-blocking so healthcheck can pass during cold start)
  void poll();

  // Continuous polling
  setInterval(() => {
    void poll();
  }, config.pollingIntervalMs);
}
