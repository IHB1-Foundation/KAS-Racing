import "dotenv/config";

export const config = {
  rpcUrl: process.env.EVM_RPC_URL || "https://rpc.kasplextest.xyz",
  chainId: Number(process.env.EVM_CHAIN_ID || "167012"),
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/kas_racing",

  // Contract addresses — loaded from address registry or env
  escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS || "0x_TO_BE_DEPLOYED",
  rewardAddress: process.env.REWARD_CONTRACT_ADDRESS || "0x_TO_BE_DEPLOYED",

  // Indexer settings
  startBlock: BigInt(process.env.START_BLOCK || "0"),
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS || "2000"),
  batchSize: Number(process.env.BATCH_SIZE || "100"),
  reorgDepth: Number(process.env.REORG_DEPTH || "10"),
};
