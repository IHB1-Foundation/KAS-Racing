# Deployment Artifacts

Each network directory contains a `latest.json` file following the `DeploymentArtifact` schema
(defined in `src/types.ts`).

## Schema (v1)

| Field                  | Type    | Description                                      |
|------------------------|---------|--------------------------------------------------|
| `version`              | number  | Schema version, always `1`                       |
| `network`              | string  | `"testnet"` or `"mainnet"`                       |
| `oraclePubkey`         | string  | x-only pubkey (hex, 64 chars) for oracle         |
| `treasuryAddress`      | string  | Kaspa address for treasury / fallback payout      |
| `refundLocktimeBlocks` | number  | DAA blocks before refund is allowed (default 1000)|
| `covenantEnabled`      | boolean | Whether covenant mode is available on this network|
| `apiBaseUrl`           | string  | REST API endpoint for the target network          |
| `explorerBaseUrl`      | string  | Block explorer base URL                           |
| `deployedAt`           | string  | ISO 8601 timestamp of deployment                  |
| `gitCommit`            | string  | Git commit hash at deployment time                |
| `notes`                | string  | Human-readable notes                              |

## Workflow

1. Run `pnpm deploy:testnet` from `apps/contracts`
2. Script validates oracle/treasury keys, generates escrow addresses, and writes `deployments/testnet/latest.json`
3. Commit the updated artifact to version control
4. Server and client reference the artifact via `@kas-racing/contracts/deployments`

## File Naming

- `latest.json` — always points to the most recent deployment
- Historical artifacts can be archived as `<timestamp>.json` if needed
