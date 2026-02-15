import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Configuration — adjust for your deployment
const MIN_DEPOSIT = ethers.parseEther("0.001"); // 0.001 KAS
const TIMEOUT_BLOCKS = 300; // ~10 min at ~2s/block
const MIN_REWARD = ethers.parseEther("0.001"); // 0.001 KAS
const MAX_REWARD = ethers.parseEther("0.1"); // 0.1 KAS
const INITIAL_VAULT_FUNDING = ethers.parseEther("0.5"); // 0.5 KAS

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== KASPLEX Testnet Deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "KAS");

  if (balance < ethers.parseEther("0.1")) {
    console.error("ERROR: Insufficient balance. Need at least 0.1 KAS for deployment + vault funding.");
    process.exitCode = 1;
    return;
  }

  // ─── Deploy MatchEscrow ─────────────────────────────────────
  console.log("\n[1/3] Deploying MatchEscrow...");
  const EscrowFactory = await ethers.getContractFactory("MatchEscrow");
  const escrow = await EscrowFactory.deploy(MIN_DEPOSIT, TIMEOUT_BLOCKS);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("  MatchEscrow deployed:", escrowAddr);

  // ─── Deploy RewardVault ─────────────────────────────────────
  console.log("\n[2/3] Deploying RewardVault...");
  const VaultFactory = await ethers.getContractFactory("RewardVault");
  const vault = await VaultFactory.deploy(MIN_REWARD, MAX_REWARD);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("  RewardVault deployed:", vaultAddr);

  // ─── Fund RewardVault ───────────────────────────────────────
  console.log("\n[3/3] Funding RewardVault with", ethers.formatEther(INITIAL_VAULT_FUNDING), "KAS...");
  const fundTx = await deployer.sendTransaction({
    to: vaultAddr,
    value: INITIAL_VAULT_FUNDING,
  });
  await fundTx.wait();
  console.log("  Funded. Vault balance:", ethers.formatEther(await ethers.provider.getBalance(vaultAddr)), "KAS");

  // ─── Get deployment block ───────────────────────────────────
  const blockNumber = await ethers.provider.getBlockNumber();

  // ─── Update address registry ────────────────────────────────
  const registryPath = path.resolve(__dirname, "../../../deploy/addresses.kasplex.testnet.json");
  const registry = {
    network: "kasplex-testnet",
    chainId: Number(network.config.chainId),
    deployer: deployer.address,
    operator: deployer.address,
    contracts: {
      MatchEscrow: escrowAddr,
      RewardVault: vaultAddr,
    },
    config: {
      minDeposit: ethers.formatEther(MIN_DEPOSIT),
      timeoutBlocks: TIMEOUT_BLOCKS,
      minReward: ethers.formatEther(MIN_REWARD),
      maxReward: ethers.formatEther(MAX_REWARD),
    },
    deployedAt: new Date().toISOString(),
    blockNumber: blockNumber,
  };

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  console.log("\n  Address registry updated:", registryPath);

  // ─── Summary ────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log("MatchEscrow:", escrowAddr);
  console.log("RewardVault:", vaultAddr);
  console.log("Block:", blockNumber);
  console.log("Registry:", registryPath);
  console.log("\nVerify on explorer:");
  console.log(`  ${getExplorerUrl()}/address/${escrowAddr}`);
  console.log(`  ${getExplorerUrl()}/address/${vaultAddr}`);
}

function getExplorerUrl(): string {
  return "https://zkevm.kasplex.org";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
