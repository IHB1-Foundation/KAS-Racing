/**
 * EVM Tx Engine — viem-based RPC client + signer for KASPLEX zkEVM
 *
 * Responsibilities:
 * - Operator key loading + validation (never logs raw key)
 * - Public + wallet client creation
 * - Contract interactions (MatchEscrow, RewardVault)
 * - Nonce management, gas estimation, receipt tracking
 * - Retry policy for transient failures
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hash,
  type TransactionReceipt,
  type Address,
  type Abi,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

// ─── Chain Definition ────────────────────────────────────────

const CHAIN_ID = Number(process.env.EVM_CHAIN_ID || "167012");
const RPC_URL = process.env.EVM_RPC_URL || "https://rpc.kasplextest.xyz";

export const kasplexTestnet: Chain = {
  id: CHAIN_ID,
  name: "KASPLEX zkEVM Testnet",
  nativeCurrency: { name: "KAS", symbol: "KAS", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
};

// ─── Key Management ──────────────────────────────────────────

let _account: PrivateKeyAccount | null = null;

function maskKey(key: string): string {
  if (key.length <= 10) return "****";
  return key.slice(0, 6) + "..." + key.slice(-4);
}

export function loadOperatorAccount(): PrivateKeyAccount {
  if (_account) return _account;

  const rawKey = process.env.OPERATOR_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error(
      "OPERATOR_PRIVATE_KEY not set. Server cannot sign transactions."
    );
  }

  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (key.length !== 66) {
    throw new Error(
      `OPERATOR_PRIVATE_KEY must be 64 hex chars (got ${key.length - 2})`
    );
  }

  _account = privateKeyToAccount(key as `0x${string}`);
  console.log(
    `[evm] Operator loaded: ${_account.address} (key: ${maskKey(key)})`
  );
  return _account;
}

// ─── Client Factory ──────────────────────────────────────────

let _publicClient: PublicClient | null = null;
let _walletClient: WalletClient | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: kasplexTestnet,
      transport: http(RPC_URL),
    });
  }
  return _publicClient;
}

export function getWalletClient(): WalletClient {
  if (!_walletClient) {
    const account = loadOperatorAccount();
    _walletClient = createWalletClient({
      account,
      chain: kasplexTestnet,
      transport: http(RPC_URL),
    });
  }
  return _walletClient;
}

// ─── Transaction Helpers ─────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface TxResult {
  hash: Hash;
  receipt: TransactionReceipt | null;
  success: boolean;
  error?: string;
  gasUsed?: bigint;
}

/**
 * Send a contract write transaction with retry
 */
export async function sendContractTx(params: {
  address: Address;
  abi: Abi;
  functionName: string;
  args: unknown[];
  value?: bigint;
}): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = loadOperatorAccount();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Simulate first
      const { request } = await publicClient.simulateContract({
        account,
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
        value: params.value,
      });

      // Send
      const hash = await wallet.writeContract(request);
      console.log(
        `[evm] Tx sent: ${hash} (${params.functionName}, attempt ${attempt})`
      );

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 30_000,
      });

      return {
        hash,
        receipt,
        success: receipt.status === "success",
        gasUsed: receipt.gasUsed,
      };
    } catch (err: any) {
      const isTransient =
        err.message?.includes("nonce") ||
        err.message?.includes("timeout") ||
        err.message?.includes("ETIMEDOUT") ||
        err.message?.includes("connection");

      if (isTransient && attempt < MAX_RETRIES) {
        console.warn(
          `[evm] Tx ${params.functionName} attempt ${attempt} failed (transient): ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`
        );
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      console.error(
        `[evm] Tx ${params.functionName} failed after ${attempt} attempts:`,
        err.message
      );
      return {
        hash: "0x" as Hash,
        receipt: null,
        success: false,
        error: err.message,
      };
    }
  }

  return { hash: "0x" as Hash, receipt: null, success: false, error: "Max retries exceeded" };
}

/**
 * Get operator's native balance
 */
export async function getOperatorBalance(): Promise<{
  wei: bigint;
  formatted: string;
}> {
  const client = getPublicClient();
  const account = loadOperatorAccount();
  const balance = await client.getBalance({ address: account.address });
  return { wei: balance, formatted: formatEther(balance) };
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<bigint> {
  return getPublicClient().getBlockNumber();
}

// ─── Utilities ───────────────────────────────────────────────

export { parseEther, formatEther };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
