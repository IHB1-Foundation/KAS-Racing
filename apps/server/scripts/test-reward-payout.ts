#!/usr/bin/env tsx
/**
 * Test Script: Reward Payout TX Builder
 *
 * This script tests the reward payout functionality:
 * 1. Derives treasury address from private key
 * 2. Fetches UTXOs from REST API
 * 3. Creates and signs a transaction
 * 4. Broadcasts the transaction (if --broadcast flag is set)
 *
 * Usage:
 *   # Dry run (no broadcast)
 *   TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=kaspa:... npx tsx scripts/test-reward-payout.ts
 *
 *   # With broadcast
 *   TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=kaspa:... npx tsx scripts/test-reward-payout.ts --broadcast
 */

import { sendRewardPayout, kasToSompi, getKaspaRestClient, getRestApiUrl } from '../src/tx/index.js';
import { getConfig, resetConfigCache } from '../src/config/index.js';

// Test recipient address (change this to your test wallet)
const TEST_RECIPIENT = process.env.TEST_RECIPIENT ?? 'kaspa:qqkqkzjvr7zwxxmjxjkmxxdwju9kjs6e9u82uh59z07vgaks6gg62v8707g73';

// Test amount (0.02 KAS = minimum)
const TEST_AMOUNT_KAS = 0.02;

async function main() {
  const doBroadcast = process.argv.includes('--broadcast');

  console.log('='.repeat(60));
  console.log('Reward Payout TX Test (REST API)');
  console.log('='.repeat(60));
  console.log(`Mode: ${doBroadcast ? 'LIVE BROADCAST' : 'DRY RUN'}`);
  console.log('');

  // Reset config cache to reload env vars
  resetConfigCache();

  try {
    // Load config
    const config = getConfig();
    console.log(`Network: ${config.network}`);
    console.log(`REST API: ${getRestApiUrl(config.network)}`);
    console.log(`Min Reward: ${config.minRewardSompi} sompi`);
    console.log(`Treasury Change Address: ${config.treasuryChangeAddress}`);
    console.log('');

    // Load kaspa-wasm and derive treasury address
    console.log('Loading kaspa-wasm...');
    const kaspa = await import('kaspa-wasm');
    console.log('kaspa-wasm loaded successfully');
    console.log('');

    // Derive treasury address
    console.log('Deriving treasury address from private key...');
    const privateKey = new kaspa.PrivateKey(config.treasuryPrivateKey);
    const keypair = privateKey.toKeypair();
    const publicKey = keypair.publicKey as string;
    const networkType = config.network === 'mainnet'
      ? kaspa.NetworkType.Mainnet
      : kaspa.NetworkType.Testnet;
    const treasuryAddress = kaspa.createAddress(publicKey, networkType) as { toString(): string };
    console.log(`Treasury Address: ${treasuryAddress.toString()}`);
    console.log('');

    // Test REST API connection
    console.log('Testing REST API connection...');
    const restClient = getKaspaRestClient(config.network);

    try {
      const health = await restClient.healthCheck();
      console.log('REST API health:', health.database);
    } catch (e) {
      console.error('REST API health check failed:', e instanceof Error ? e.message : e);
      if (config.network === 'testnet') {
        console.log('\nNote: Testnet REST API (api-tn11.kaspa.org) may be unavailable.');
        console.log('Try using mainnet for testing: NETWORK=mainnet');
      }
      process.exit(1);
    }
    console.log('');

    // Fetch UTXOs
    console.log('Fetching UTXOs...');
    const addressStr = treasuryAddress.toString();
    const utxos = await restClient.getUtxosByAddress(addressStr);
    console.log(`Found ${utxos.length} UTXOs`);

    if (utxos.length > 0) {
      let total = 0n;
      for (const entry of utxos) {
        const amount = BigInt(entry.utxoEntry.amount);
        total += amount;
        console.log(`  - ${entry.outpoint.transactionId.slice(0, 16)}...: ${amount} sompi`);
      }
      console.log(`Total balance: ${total} sompi (${Number(total) / 100_000_000} KAS)`);
    } else {
      console.log('No UTXOs found. Fund this address to test transactions.');
      if (!doBroadcast) {
        console.log('');
        console.log('DRY RUN completed - connection test passed!');
        return;
      }
    }
    console.log('');

    if (!doBroadcast) {
      console.log('[DRY RUN] Skipping actual transaction send.');
      console.log('To broadcast a real transaction, run with --broadcast flag.');
      console.log('');
      console.log('Connection test passed!');
      return;
    }

    // Live broadcast mode
    console.log('Sending reward payout...');
    console.log(`  Recipient: ${TEST_RECIPIENT}`);
    console.log(`  Amount: ${TEST_AMOUNT_KAS} KAS (${kasToSompi(TEST_AMOUNT_KAS)} sompi)`);
    console.log('');

    const result = await sendRewardPayout({
      toAddress: TEST_RECIPIENT,
      amountSompi: kasToSompi(TEST_AMOUNT_KAS),
    });

    console.log('='.repeat(60));
    console.log('Transaction Submitted Successfully!');
    console.log('='.repeat(60));
    console.log(`TXID: ${result.txid}`);
    console.log(`Amount: ${result.amountSompi} sompi`);
    console.log(`Fee: ${result.feeSompi} sompi`);
    console.log('');

    const explorerBase = config.network === 'mainnet'
      ? 'https://explorer.kaspa.org'
      : 'https://explorer-tn11.kaspa.org';
    console.log(`Explorer: ${explorerBase}/txs/${result.txid}`);

  } catch (error) {
    console.error('');
    console.error('ERROR:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
