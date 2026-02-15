# Chain / Wallet / Token Decision Matrix

> Single reference for all contributors — FE, BE, Indexer, and ops.
> Last updated: 2026-02-15 (T-301)

---

## 1. Chain

| Field | Value |
|---|---|
| **Network name** | KASPLEX zkEVM Testnet |
| **Chain ID** | `167012` |
| **RPC URL** | `https://rpc.kasplextest.xyz` |
| **WebSocket RPC** | `wss://rpc.kasplextest.xyz` (if available; check at deploy time) |
| **Block Explorer** | `https://zkevm.kasplex.org` |
| **Native currency** | KAS |
| **Currency decimals** | 18 |
| **Currency symbol** | KAS |
| **Average block time** | ~2s (subject to testnet conditions) |
| **Finality model** | Single confirmation is sufficient for demo |

### MetaMask `wallet_addEthereumChain` params

```json
{
  "chainId": "0x28C44",
  "chainName": "KASPLEX zkEVM Testnet",
  "nativeCurrency": {
    "name": "KAS",
    "symbol": "KAS",
    "decimals": 18
  },
  "rpcUrls": ["https://rpc.kasplextest.xyz"],
  "blockExplorerUrls": ["https://zkevm.kasplex.org"]
}
```

---

## 2. Wallets

| Wallet | Support Level | Notes |
|---|---|---|
| **MetaMask** | Primary | Desktop extension + mobile. Auto chain-add via `wallet_addEthereumChain`. |
| **Rabby** | Backup | EVM-compatible, works with same wagmi connector. |
| **WalletConnect v2** | Stretch | Mobile coverage; implement only if time allows. |

### wagmi connector config

```ts
import { injected } from "wagmi/connectors";

const connectors = [
  injected(), // MetaMask, Rabby, any injected EIP-1193 provider
];
```

### Wallet UX Requirements

1. Auto-prompt chain add/switch if user is on wrong network.
2. Show clear error if wallet not detected.
3. Display connected address (truncated) + network badge in header.
4. Disconnect button always visible when connected.

---

## 3. Token / Currency

| Field | Value |
|---|---|
| **Demo currency** | Native KAS (not ERC-20) |
| **Decimals** | 18 |
| **Min reward amount** | 0.001 KAS (`1000000000000000` wei) |
| **Default reward tiers** | 0.001, 0.005, 0.01 KAS |
| **Duel deposit amount** | 0.01 KAS (configurable) |
| **Faucet** | Manual funding from treasury wallet |

### Why native KAS (not ERC-20)?

- Simpler UX: no token approve step for rewards.
- Fewer contracts to deploy and audit.
- Duel flow uses native value transfers (payable functions).
- ERC-20 support can be added later as a stretch goal.

### Faucet / Funding Strategy

1. **Treasury wallet** is pre-funded with testnet KAS.
2. **Player wallets** receive testnet KAS from treasury during onboarding (or via manual faucet).
3. No public faucet dependency — we control our own funding.

---

## 4. Contract Address Registry

Contract addresses are stored in `deploy/addresses.kasplex.testnet.json` and updated after each deployment (T-314).

**Pre-deployment placeholder:**

```json
{
  "network": "kasplex-testnet",
  "chainId": 167012,
  "deployer": "0x_TO_BE_SET",
  "operator": "0x_TO_BE_SET",
  "contracts": {
    "MatchEscrow": "0x_TO_BE_DEPLOYED",
    "RewardVault": "0x_TO_BE_DEPLOYED"
  },
  "deployedAt": null,
  "blockNumber": null
}
```

### Address Roles

| Role | Description | Key Location |
|---|---|---|
| **Deployer** | Deploys contracts | Server `.env` (`DEPLOYER_PRIVATE_KEY`) |
| **Operator** | Calls settle(), payReward() | Server `.env` (`OPERATOR_PRIVATE_KEY`) |
| **Player** | Connects via MetaMask, signs deposits | Browser wallet |

---

## 5. Quick Reference for Contributors

### Frontend developer

- Use `wagmi` + `viem` for all chain interactions.
- Chain ID: `167012`. RPC: `https://rpc.kasplextest.xyz`.
- Contract ABIs will be in `apps/contracts-evm/artifacts/` (typechain generated).
- Wallet: `injected()` connector covers MetaMask + Rabby.

### Backend developer

- Use `viem` for RPC client + contract calls.
- Operator key from `OPERATOR_PRIVATE_KEY` env var.
- Contract addresses from `deploy/addresses.kasplex.testnet.json`.
- All amounts in wei (18 decimals). Use `parseEther()` / `formatEther()`.

### Indexer developer

- Ponder config targets Chain ID `167012`, RPC `https://rpc.kasplextest.xyz`.
- Index events from MatchEscrow + RewardVault contracts.
- Start block = deployment block number (from address registry).

---

## 6. Explorer Links

| Resource | URL Pattern |
|---|---|
| Transaction | `https://zkevm.kasplex.org/tx/{txHash}` |
| Address | `https://zkevm.kasplex.org/address/{address}` |
| Block | `https://zkevm.kasplex.org/block/{blockNumber}` |
