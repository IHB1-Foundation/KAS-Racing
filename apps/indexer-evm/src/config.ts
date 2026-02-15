import "dotenv/config";

const PROD_ESCROW_ADDRESS = "0x62c0a62d3121499a92293B8Bd95f8073D226Fb02";
const PROD_REWARD_ADDRESS = "0xa706104A1F63cb360B8d405a60132424a81986A8";
const PROD_START_BLOCK = "18844962";

const isProd = process.env.NODE_ENV === "production";

export const config = {
  rpcUrl: process.env.EVM_RPC_URL || "https://rpc.kasplextest.xyz",
  chainId: Number(process.env.EVM_CHAIN_ID || "167012"),
  databaseUrl: process.env.DATABASE_URL || "postgres://localhost:5432/kas_racing",

  // Contract addresses — loaded from env with prod fallback
  escrowAddress: process.env.ESCROW_CONTRACT_ADDRESS || (isProd ? PROD_ESCROW_ADDRESS : "0x_TO_BE_DEPLOYED"),
  rewardAddress: process.env.REWARD_CONTRACT_ADDRESS || (isProd ? PROD_REWARD_ADDRESS : "0x_TO_BE_DEPLOYED"),

  // Indexer settings
  startBlock: BigInt(process.env.START_BLOCK || (isProd ? PROD_START_BLOCK : "0")),
  pollingIntervalMs: Number(process.env.POLLING_INTERVAL_MS || "2000"),
  batchSize: Number(process.env.BATCH_SIZE || "100"),
  reorgDepth: Number(process.env.REORG_DEPTH || "10"),
};
