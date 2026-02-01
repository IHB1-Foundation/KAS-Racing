#!/usr/bin/env tsx
/**
 * Test Script: Reward Payout TX Builder
 *
 * This script tests the reward payout functionality:
 * 1. Connects to Kaspa testnet RPC
 * 2. Derives treasury address from private key
 * 3. Fetches UTXOs
 * 4. Creates and signs a transaction
 * 5. Broadcasts the transaction (if --broadcast flag is set)
 *
 * Usage:
 *   # Dry run (no broadcast)
 *   TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=kaspatest:... tsx scripts/test-reward-payout.ts
 *
 *   # With broadcast
 *   TREASURY_PRIVATE_KEY=... TREASURY_CHANGE_ADDRESS=kaspatest:... tsx scripts/test-reward-payout.ts --broadcast
 */

import { sendRewardPayout, kasToSompi, disconnectKaspa, getKaspaWasm } from '../src/tx/index.js';
import { getConfig, resetConfigCache } from '../src/config/index.js';

// Test recipient address (change this to your test wallet)
const TEST_RECIPIENT = process.env.TEST_RECIPIENT ?? 'kaspatest:qz0c8gf8lm54u4m3dw6p0z23vhfmryj8x7qxmq9k5v';

// Test amount (0.02 KAS = minimum)
const TEST_AMOUNT_KAS = 0.02;

async function main() {
  const doBroadcast = process.argv.includes('--broadcast');

  console.log('='.repeat(60));
  console.log('Reward Payout TX Test');
  console.log('='.repeat(60));
  console.log(`Mode: ${doBroadcast ? 'LIVE BROADCAST' : 'DRY RUN'}`);
  console.log('');

  // Reset config cache to reload env vars
  resetConfigCache();

  try {
    // Load config
    const config = getConfig();
    console.log(`Network: ${config.network}`);
    console.log(`Min Reward: ${config.minRewardSompi} sompi`);
    console.log(`Treasury Change Address: ${config.treasuryChangeAddress}`);
    console.log('');

    // Load kaspa-wasm and derive treasury address
    console.log('Loading kaspa-wasm...');
    const kaspa = await getKaspaWasm();
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
    const treasuryAddress = kaspa.createAddress(publicKey, networkType);
    console.log(`Treasury Address: ${treasuryAddress.toString()}`);
    console.log('');

    if (!doBroadcast) {
      console.log('[DRY RUN] Skipping actual transaction send.');
      console.log('To broadcast a real transaction, run with --broadcast flag.');
      console.log('');
      console.log('Testing connection to RPC...');

      // Just test RPC connection
      const { getKaspaClient } = await import('../src/tx/kaspaClient.js');
      const client = await getKaspaClient();
      console.log('RPC connected successfully!');

      // Fetch UTXOs
      const addressStr = treasuryAddress.toString();
      const response = await client.getUtxosByAddresses([addressStr]);
      console.log(`Found ${response.entries.length} UTXOs`);

      if (response.entries.length > 0) {
        let total = 0n;
        for (const entry of response.entries) {
          const amount = BigInt(entry.utxoEntry.amount);
          total += amount;
          console.log(`  - ${entry.outpoint.transactionId.slice(0, 16)}...: ${amount} sompi`);
        }
        console.log(`Total balance: ${total} sompi (${Number(total) / 100_000_000} KAS)`);
      } else {
        console.log('No UTXOs found. Fund this address to test transactions.');
      }

      await disconnectKaspa();
      console.log('');
      console.log('✓ Connection test passed!');
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
    console.log(`Explorer: https://explorer-tn11.kaspa.org/txs/${result.txid}`);

  } catch (error) {
    console.error('');
    console.error('ERROR:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await disconnectKaspa();
  }
}

main().catch(console.error);
