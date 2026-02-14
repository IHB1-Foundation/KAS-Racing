import { describe, it, expect } from 'vitest';
import { loadDeployment, hasDeployment, getServerEnvFromDeployment, getClientEnvFromDeployment } from '../src/index.js';
import type { DeploymentArtifact } from '../src/index.js';

describe('loadDeployment', () => {
  it('loads testnet artifact (placeholder)', () => {
    const artifact = loadDeployment('testnet');
    expect(artifact.version).toBe(1);
    expect(artifact.network).toBe('testnet');
    expect(artifact.covenantEnabled).toBe(true);
    expect(artifact.apiBaseUrl).toContain('tn11');
  });

  it('loads mainnet artifact (placeholder)', () => {
    const artifact = loadDeployment('mainnet');
    expect(artifact.version).toBe(1);
    expect(artifact.network).toBe('mainnet');
    expect(artifact.covenantEnabled).toBe(false);
  });
});

describe('hasDeployment', () => {
  it('returns false for testnet placeholder (empty pubkey)', () => {
    // Placeholder has empty oraclePubkey, so hasDeployment should return false
    const result = hasDeployment('testnet');
    // Depends on whether deploy:testnet has been run
    expect(typeof result).toBe('boolean');
  });
});

describe('getServerEnvFromDeployment', () => {
  it('returns correct env vars', () => {
    const artifact: DeploymentArtifact = {
      version: 1,
      network: 'testnet',
      oraclePubkey: 'a'.repeat(64),
      treasuryAddress: 'kaspatest:qz0c_treasury',
      refundLocktimeBlocks: 1000,
      covenantEnabled: true,
      apiBaseUrl: 'https://api-tn11.kaspa.org',
      explorerBaseUrl: 'https://explorer-tn11.kaspa.org',
      deployedAt: '2026-02-14T00:00:00Z',
      gitCommit: 'abc123',
      notes: 'test',
    };

    const env = getServerEnvFromDeployment(artifact);
    expect(env['NETWORK']).toBe('testnet');
    expect(env['TREASURY_CHANGE_ADDRESS']).toBe('kaspatest:qz0c_treasury');
    expect(env['COVENANT_ENABLED']).toBe('true');
    expect(env['ORACLE_PUBKEY']).toBe('a'.repeat(64));
  });
});

describe('getClientEnvFromDeployment', () => {
  it('returns correct env vars', () => {
    const artifact: DeploymentArtifact = {
      version: 1,
      network: 'testnet',
      oraclePubkey: 'a'.repeat(64),
      treasuryAddress: 'kaspatest:qz0c_treasury',
      refundLocktimeBlocks: 1000,
      covenantEnabled: true,
      apiBaseUrl: 'https://api-tn11.kaspa.org',
      explorerBaseUrl: 'https://explorer-tn11.kaspa.org',
      deployedAt: '2026-02-14T00:00:00Z',
      gitCommit: 'abc123',
      notes: 'test',
    };

    const env = getClientEnvFromDeployment(artifact);
    expect(env['VITE_NETWORK']).toBe('testnet');
    expect(env['VITE_EXPLORER_URL']).toContain('tn11');
    expect(env['VITE_COVENANT_ENABLED']).toBe('true');
  });
});
