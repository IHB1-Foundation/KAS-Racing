import { randomBytes } from 'crypto';
import type { Hash } from 'viem';
import { db } from '../db/index.js';
import {
  chainEventsEvm,
  rewardEventsV3,
  settlementsV3,
  depositsV3,
  matchesV3,
  raceMarkets,
  oddsTicks,
  betOrders,
  betCancels,
  marketSettlements,
  sessions,
  users,
  idempotencyKeys,
} from '../db/schema.js';

const E2E_ENABLED = process.env.E2E_TEST_MODE === 'true';

let mockBlockNumber = BigInt(process.env.E2E_BLOCK_START ?? '1000');
let mockLogIndex = 0;

export function isE2EEnabled(): boolean {
  return E2E_ENABLED;
}

export function nextMockTxHash(): Hash {
  return `0x${randomBytes(32).toString('hex')}`;
}

export function nextMockBlockNumber(): bigint {
  mockBlockNumber += 1n;
  return mockBlockNumber;
}

export function nextMockLogIndex(): number {
  mockLogIndex += 1;
  return mockLogIndex;
}

export async function insertChainEvent(params: {
  contract: string;
  eventName: string;
  args: Record<string, unknown>;
  txHash?: string;
  blockNumber?: bigint;
  createdAt?: Date;
}): Promise<{ txHash: string; blockNumber: bigint; logIndex: number }> {
  const txHash = params.txHash ?? nextMockTxHash();
  const blockNumber = params.blockNumber ?? nextMockBlockNumber();
  const createdAt = params.createdAt ?? new Date();
  const logIndex = nextMockLogIndex();

  await db.insert(chainEventsEvm).values({
    blockNumber,
    txHash,
    logIndex,
    contract: params.contract,
    eventName: params.eventName,
    args: JSON.stringify(params.args ?? {}),
    createdAt,
  });

  return { txHash, blockNumber, logIndex };
}

export async function resetE2EData(): Promise<void> {
  if (!E2E_ENABLED) return;

  mockBlockNumber = BigInt(process.env.E2E_BLOCK_START ?? '1000');
  mockLogIndex = 0;

  await db.delete(betCancels);
  await db.delete(betOrders);
  await db.delete(oddsTicks);
  await db.delete(marketSettlements);
  await db.delete(raceMarkets);
  await db.delete(settlementsV3);
  await db.delete(depositsV3);
  await db.delete(rewardEventsV3);
  await db.delete(matchesV3);
  await db.delete(sessions);
  await db.delete(users);
  await db.delete(idempotencyKeys);
  await db.delete(chainEventsEvm);
}
