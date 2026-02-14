#!/usr/bin/env tsx
/**
 * Deployment Verification Script
 *
 * Reads the deployment artifact, verifies API connectivity,
 * generates a sample escrow pair, and optionally runs a
 * create-deposit-settle dry-run flow.
 *
 * Usage:
 *   # Basic verification (read artifact + check API)
 *   pnpm verify:testnet
 *
 *   # Full E2E dry-run (generates escrow, simulates match flow)
 *   E2E=true pnpm verify:testnet
 *
 * Required env vars (for E2E):
 *   ORACLE_PRIVATE_KEY       — 64-char hex
 *   TREASURY_PRIVATE_KEY     — 64-char hex
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as kaspa from 'kaspa-wasm';
import { generateMatchEscrows } from '../src/scriptBuilder.js';
import { calculateOutputs } from '../src/settlementTxBuilder.js';
import { createMatchContext, transition } from '../src/matchStateMachine.js';
import { validateSettlementRequest, validateSettlementOutputs } from '../src/validation.js';
import type { DeploymentArtifact } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isE2E = process.env['E2E'] === 'true';

function log(msg: string) {
  console.log(`[verify] ${msg}`);
}

function pass(check: string) {
  console.log(`  ✓ ${check}`);
}

function fail(check: string, reason: string) {
  console.error(`  ✗ ${check}: ${reason}`);
}

async function main() {
  log('=== Deployment Verification ===');
  let failures = 0;

  // Step 1: Load artifact
  log('');
  log('Step 1: Load deployment artifact');
  const artifactPath = resolve(__dirname, '..', 'deployments', 'testnet', 'latest.json');
  let artifact: DeploymentArtifact;
  try {
    const raw = readFileSync(artifactPath, 'utf-8');
    artifact = JSON.parse(raw);
    pass('Artifact loaded');
  } catch (err) {
    fail('Artifact load', String(err));
    console.error('Run `pnpm deploy:testnet` first.');
    process.exit(1);
  }

  // Step 2: Validate artifact fields
  log('');
  log('Step 2: Validate artifact fields');
  if (artifact.version === 1) pass('Version = 1');
  else { fail('Version', `Expected 1, got ${artifact.version}`); failures++; }

  if (artifact.network === 'testnet') pass('Network = testnet');
  else { fail('Network', `Expected testnet, got ${artifact.network}`); failures++; }

  if (artifact.oraclePubkey && artifact.oraclePubkey.length === 64) pass('Oracle pubkey present (64 hex)');
  else { fail('Oracle pubkey', 'Missing or invalid'); failures++; }

  if (artifact.treasuryAddress?.startsWith('kaspatest:')) pass('Treasury address is testnet');
  else { fail('Treasury address', 'Missing or not testnet'); failures++; }

  if (artifact.covenantEnabled) pass('Covenant enabled');
  else { fail('Covenant', 'Not enabled for testnet'); failures++; }

  if (artifact.deployedAt) pass(`Deployed at: ${artifact.deployedAt}`);
  else { fail('DeployedAt', 'Missing'); failures++; }

  if (artifact.gitCommit) pass(`Git commit: ${artifact.gitCommit.substring(0, 8)}`);
  else { fail('Git commit', 'Missing'); failures++; }

  // Step 3: Check API connectivity
  log('');
  log('Step 3: Check testnet API');
  try {
    const resp = await fetch(`${artifact.apiBaseUrl}/info/blockdag`);
    if (resp.ok) {
      const info = await resp.json() as { virtualDaaScore?: number };
      pass(`API reachable (DAA score: ${info.virtualDaaScore ?? 'unknown'})`);
    } else {
      fail('API check', `HTTP ${resp.status}`);
      failures++;
    }
  } catch (err) {
    fail('API check', `Unreachable: ${err}`);
    failures++;
  }

  // Step 4: Sample escrow from artifact
  log('');
  log('Step 4: Check sample escrow in artifact');
  if (artifact.sampleEscrow) {
    pass(`Match ID: ${artifact.sampleEscrow.matchId}`);
    pass(`Escrow A: ${artifact.sampleEscrow.escrowAddressA}`);
    pass(`Escrow B: ${artifact.sampleEscrow.escrowAddressB}`);
  } else {
    fail('Sample escrow', 'Not present in artifact');
    failures++;
  }

  // Step 5: E2E dry-run flow (if requested)
  if (isE2E) {
    log('');
    log('Step 5: E2E dry-run (create → deposit → settle)');

    const oracleKey = process.env['ORACLE_PRIVATE_KEY'];
    const treasuryKey = process.env['TREASURY_PRIVATE_KEY'];
    if (!oracleKey || !treasuryKey) {
      fail('E2E', 'ORACLE_PRIVATE_KEY and TREASURY_PRIVATE_KEY required for E2E');
      failures++;
    } else {
      try {
        // Derive keys
        const oraclePriv = new kaspa.PrivateKey(oracleKey);
        const oraclePubkey = (oraclePriv.toKeypair().publicKey as string);
        const treasuryPriv = new kaspa.PrivateKey(treasuryKey);
        const treasuryPubkey = (treasuryPriv.toKeypair().publicKey as string);
        const treasuryAddr = kaspa.createAddress(treasuryPubkey, kaspa.NetworkType.Testnet).toString();
        pass('Keys derived');

        // Simulate player B with a derived key
        const playerBPubkey = '0'.repeat(62) + '02';
        const playerBAddr = 'kaspatest:qqplayer_b_verification_addr';

        // 5a: Create match context
        const ctx = createMatchContext({
          matchId: 'verify-e2e-test',
          playerAAddress: treasuryAddr,
          betAmountSompi: BigInt(50_000_000),
          escrowMode: 'covenant',
          createdAtBlock: 1000,
        });
        pass('Match context created');

        // 5b: Join
        let r = transition(ctx, 'join');
        if (r.ok) { ctx.state = r.newState; pass('Player A joined'); }
        else { fail('Join A', r.error!); failures++; }

        ctx.playerBAddress = playerBAddr;
        ctx.playerBPubkey = playerBPubkey;
        r = transition(ctx, 'join');
        if (r.ok) { ctx.state = r.newState; pass('Player B joined'); }
        else { fail('Join B', r.error!); failures++; }

        // 5c: Generate escrow addresses
        const escrows = await generateMatchEscrows(
          'verify-e2e-test',
          treasuryPubkey,
          treasuryAddr,
          playerBPubkey,
          playerBAddr,
          oraclePubkey,
          'testnet'
        );
        ctx.escrowScriptA = escrows.escrowA.scriptHex;
        ctx.escrowScriptB = escrows.escrowB.scriptHex;
        ctx.escrowAddressA = escrows.escrowA.address;
        ctx.escrowAddressB = escrows.escrowB.address;
        pass(`Escrow A: ${escrows.escrowA.address}`);
        pass(`Escrow B: ${escrows.escrowB.address}`);

        // 5d: Simulate deposits
        r = transition(ctx, 'deposit_a');
        if (r.ok) { ctx.depositATxid = 'simulated-deposit-a'; pass('Deposit A registered'); }
        else { fail('Deposit A', r.error!); failures++; }

        r = transition(ctx, 'deposit_b');
        if (r.ok) { ctx.depositBTxid = 'simulated-deposit-b'; pass('Deposit B registered'); }
        else { fail('Deposit B', r.error!); failures++; }

        // 5e: Confirm deposits
        r = transition(ctx, 'confirm_deposit_a');
        if (r.ok) { ctx.depositAConfirmed = true; ctx.state = r.newState; pass('Deposit A confirmed'); }
        else { fail('Confirm A', r.error!); failures++; }

        r = transition(ctx, 'confirm_deposit_b');
        if (r.ok) { ctx.depositBConfirmed = true; ctx.state = r.newState; pass('Deposit B confirmed'); }
        else { fail('Confirm B', r.error!); failures++; }

        if (ctx.state === 'deposits_confirmed') pass('State: deposits_confirmed');
        else { fail('State', `Expected deposits_confirmed, got ${ctx.state}`); failures++; }

        // 5f: Race + submit result
        r = transition(ctx, 'start_race');
        if (r.ok) { ctx.state = r.newState; pass('Race started'); }
        else { fail('Start race', r.error!); failures++; }

        r = transition(ctx, 'submit_result');
        if (r.ok) { ctx.state = r.newState; ctx.winnerAddress = treasuryAddr; pass('Result submitted (A wins)'); }
        else { fail('Submit result', r.error!); failures++; }

        // 5g: Validate settlement
        const settlementRequest = {
          matchId: 'verify-e2e-test',
          type: 'winner_A' as const,
          depositA: { txid: 'simulated-deposit-a', index: 0, amount: BigInt(50_000_000) },
          depositB: { txid: 'simulated-deposit-b', index: 0, amount: BigInt(50_000_000) },
        };
        const validation = validateSettlementRequest(settlementRequest, ctx);
        if (validation.valid) pass('Settlement request validated');
        else { fail('Settlement validation', validation.error!); failures++; }

        // 5h: Calculate outputs + validate
        const outputs = calculateOutputs('winner_A', BigInt(50_000_000), BigInt(50_000_000), treasuryAddr, playerBAddr);
        const outputVal = validateSettlementOutputs(outputs, treasuryAddr, playerBAddr);
        if (outputVal.valid) pass(`Settlement outputs valid (winner gets ${outputs[0]?.amount} sompi)`);
        else { fail('Output validation', outputVal.error!); failures++; }

        // 5i: Settle
        r = transition(ctx, 'settle');
        if (r.ok) { ctx.state = r.newState; ctx.settleTxid = 'simulated-settle-tx'; pass('Match settled'); }
        else { fail('Settle', r.error!); failures++; }

        pass('E2E dry-run complete: create → deposit → settle ✓');

      } catch (err) {
        fail('E2E flow', String(err));
        failures++;
      }
    }
  }

  // Summary
  log('');
  log('=== Verification Summary ===');
  if (failures === 0) {
    log('All checks passed ✓');
  } else {
    log(`${failures} check(s) failed ✗`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
