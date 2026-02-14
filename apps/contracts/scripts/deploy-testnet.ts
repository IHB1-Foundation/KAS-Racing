#!/usr/bin/env tsx
/**
 * Testnet Deployment Script
 *
 * Validates configuration, generates a sample escrow address pair as proof,
 * and writes the deployment artifact.
 *
 * Usage:
 *   # Dry run (default) — validates keys + generates artifact + sample escrow
 *   pnpm deploy:testnet
 *
 *   # Live mode — also verifies testnet API connectivity
 *   DEPLOY_LIVE=true pnpm deploy:testnet
 *
 * Required env vars:
 *   ORACLE_PRIVATE_KEY       — 64-char hex
 *   TREASURY_PRIVATE_KEY     — 64-char hex
 *   TREASURY_CHANGE_ADDRESS  — kaspatest:q... address
 */

import * as kaspa from 'kaspa-wasm';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateMatchEscrows } from '../src/scriptBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DeploymentArtifact {
  version: 1;
  network: 'testnet' | 'mainnet';
  oraclePubkey: string;
  treasuryAddress: string;
  refundLocktimeBlocks: number;
  covenantEnabled: boolean;
  apiBaseUrl: string;
  explorerBaseUrl: string;
  deployedAt: string;
  gitCommit: string;
  notes: string;
  sampleEscrow?: {
    matchId: string;
    escrowAddressA: string;
    escrowAddressB: string;
    generatedAt: string;
  };
}

const NETWORK = 'testnet' as const;
const isDryRun = process.env['DEPLOY_LIVE'] !== 'true';

function log(msg: string) {
  console.log(`[deploy:${NETWORK}] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[deploy:${NETWORK}] ERROR: ${msg}`);
  process.exit(1);
}

function validateHexKey(value: string | undefined, name: string): string {
  if (!value) {
    fail(`${name} is required. Set it as an environment variable.`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    fail(`${name} must be a 64-character hex string.`);
  }
  return value;
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main() {
  log(isDryRun ? 'DRY RUN — no on-chain actions' : 'LIVE MODE');
  log('Validating configuration...');

  const oracleKey = validateHexKey(process.env['ORACLE_PRIVATE_KEY'], 'ORACLE_PRIVATE_KEY');
  const treasuryKey = validateHexKey(process.env['TREASURY_PRIVATE_KEY'], 'TREASURY_PRIVATE_KEY');
  const treasuryAddress = process.env['TREASURY_CHANGE_ADDRESS'];

  if (!treasuryAddress || !treasuryAddress.startsWith('kaspatest:')) {
    fail('TREASURY_CHANGE_ADDRESS must be a testnet address (kaspatest:...)');
  }

  // Derive public keys
  const oraclePriv = new kaspa.PrivateKey(oracleKey);
  const oracleKeypair = oraclePriv.toKeypair();
  const oraclePubkey = oracleKeypair.publicKey as string;

  const treasuryPriv = new kaspa.PrivateKey(treasuryKey);
  const treasuryKeypair = treasuryPriv.toKeypair();
  const treasuryPubkey = treasuryKeypair.publicKey as string;
  const derivedTreasuryAddr = kaspa.createAddress(
    treasuryPubkey,
    kaspa.NetworkType.Testnet
  ).toString();

  log(`Oracle pubkey: ${oraclePubkey}`);
  log(`Treasury address (config): ${treasuryAddress}`);
  log(`Treasury address (derived): ${derivedTreasuryAddr}`);

  // Generate sample escrow addresses as proof of pipeline
  log('Generating sample escrow addresses...');
  let sampleEscrow: DeploymentArtifact['sampleEscrow'];
  try {
    const sampleMatchId = `deploy-proof-${Date.now()}`;
    // Use treasury pubkey as fake playerA and a dummy playerB for sample
    const dummyPlayerBKey = '0'.repeat(62) + '01';
    const dummyPlayerBAddr = 'kaspatest:qq0000000000000000000000000000000000000000000000000000001';

    const result = await generateMatchEscrows(
      sampleMatchId,
      treasuryPubkey,
      derivedTreasuryAddr,
      dummyPlayerBKey,
      dummyPlayerBAddr,
      oraclePubkey,
      'testnet'
    );

    sampleEscrow = {
      matchId: sampleMatchId,
      escrowAddressA: result.escrowA.address,
      escrowAddressB: result.escrowB.address,
      generatedAt: new Date().toISOString(),
    };

    log(`Sample escrow A: ${result.escrowA.address}`);
    log(`Sample escrow B: ${result.escrowB.address}`);
  } catch (err) {
    log(`Warning: Sample escrow generation failed: ${err}`);
    log('Continuing without sample escrow...');
  }

  if (!isDryRun) {
    // Verify REST API is reachable
    log('Checking testnet API...');
    try {
      const resp = await fetch('https://api-tn11.kaspa.org/info/blockdag');
      if (!resp.ok) {
        fail(`Testnet API returned ${resp.status}`);
      }
      const info = await resp.json() as { tipHashes: string[]; virtualDaaScore: number };
      log(`Testnet API OK — tip hashes: ${(info.tipHashes ?? []).length}`);
      if (info.virtualDaaScore) {
        log(`Current DAA score: ${info.virtualDaaScore}`);
      }
    } catch (err) {
      fail(`Testnet API unreachable: ${err}`);
    }
  }

  // Write deployment artifact
  const artifact: DeploymentArtifact = {
    version: 1,
    network: NETWORK,
    oraclePubkey,
    treasuryAddress,
    refundLocktimeBlocks: 1000,
    covenantEnabled: true,
    apiBaseUrl: 'https://api-tn11.kaspa.org',
    explorerBaseUrl: 'https://explorer-tn11.kaspa.org',
    deployedAt: new Date().toISOString(),
    gitCommit: getGitCommit(),
    notes: isDryRun
      ? 'Dry-run deployment — keys validated, escrow addresses generated, no on-chain actions.'
      : 'Live testnet deployment.',
    sampleEscrow,
  };

  const outDir = resolve(__dirname, '..', 'deployments', 'testnet');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const outPath = resolve(outDir, 'latest.json');
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
  log(`Artifact written to ${outPath}`);

  // Summary
  log('');
  log('=== Deployment Summary ===');
  log(`  Network:        ${artifact.network}`);
  log(`  Covenant:       ${artifact.covenantEnabled ? 'enabled' : 'disabled'}`);
  log(`  Oracle:         ${artifact.oraclePubkey.substring(0, 16)}...`);
  log(`  Treasury:       ${artifact.treasuryAddress}`);
  log(`  Locktime:       ${artifact.refundLocktimeBlocks} DAA blocks`);
  log(`  Git commit:     ${artifact.gitCommit.substring(0, 8)}`);
  log(`  Mode:           ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (sampleEscrow) {
    log(`  Sample escrow A: ${sampleEscrow.escrowAddressA}`);
    log(`  Sample escrow B: ${sampleEscrow.escrowAddressB}`);
  }
  log('==========================');
  log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
