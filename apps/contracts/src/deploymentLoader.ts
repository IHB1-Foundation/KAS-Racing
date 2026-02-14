/**
 * Deployment Artifact Loader
 *
 * Provides a unified way for server and client to load deployment
 * configuration from the contracts package.
 *
 * Usage:
 *   import { loadDeployment } from '@kas-racing/contracts';
 *   const deployment = loadDeployment('testnet');
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DeploymentArtifact, Network } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load deployment artifact for a given network.
 * Looks in the deployments directory relative to this package.
 */
export function loadDeployment(network: Network): DeploymentArtifact {
  const artifactPath = resolveArtifactPath(network);

  if (!existsSync(artifactPath)) {
    throw new Error(
      `Deployment artifact not found for ${network}. ` +
      `Expected at: ${artifactPath}. ` +
      `Run 'pnpm deploy:testnet' in apps/contracts to generate.`
    );
  }

  const raw = readFileSync(artifactPath, 'utf-8');
  const artifact = JSON.parse(raw) as DeploymentArtifact;

  validateArtifact(artifact, network);

  return artifact;
}

/**
 * Check if a deployment artifact exists for a network.
 */
export function hasDeployment(network: Network): boolean {
  const path = resolveArtifactPath(network);
  if (!existsSync(path)) return false;

  try {
    const raw = readFileSync(path, 'utf-8');
    const artifact = JSON.parse(raw) as DeploymentArtifact;
    return !!artifact.oraclePubkey && !!artifact.treasuryAddress;
  } catch {
    return false;
  }
}

/**
 * Get environment variables needed by the server from a deployment artifact.
 */
export function getServerEnvFromDeployment(artifact: DeploymentArtifact): Record<string, string> {
  return {
    NETWORK: artifact.network,
    TREASURY_CHANGE_ADDRESS: artifact.treasuryAddress,
    KASPA_API_URL: artifact.apiBaseUrl,
    KASPA_EXPLORER_URL: artifact.explorerBaseUrl,
    COVENANT_ENABLED: String(artifact.covenantEnabled),
    REFUND_LOCKTIME_BLOCKS: String(artifact.refundLocktimeBlocks),
    ORACLE_PUBKEY: artifact.oraclePubkey,
  };
}

/**
 * Get environment variables needed by the client from a deployment artifact.
 */
export function getClientEnvFromDeployment(artifact: DeploymentArtifact): Record<string, string> {
  return {
    VITE_NETWORK: artifact.network,
    VITE_EXPLORER_URL: artifact.explorerBaseUrl,
    VITE_COVENANT_ENABLED: String(artifact.covenantEnabled),
  };
}

function resolveArtifactPath(network: Network): string {
  // Works from both src/ (development) and dist/ (production)
  const srcPath = resolve(__dirname, '..', 'deployments', network, 'latest.json');
  const distPath = resolve(__dirname, '..', '..', 'deployments', network, 'latest.json');
  return existsSync(srcPath) ? srcPath : distPath;
}

function validateArtifact(artifact: DeploymentArtifact, expectedNetwork: Network): void {
  if (artifact.version !== 1) {
    throw new Error(`Unsupported artifact version: ${String(artifact.version)}`);
  }
  if (artifact.network !== expectedNetwork) {
    throw new Error(
      `Artifact network mismatch: expected ${expectedNetwork}, got ${artifact.network}`
    );
  }
}
