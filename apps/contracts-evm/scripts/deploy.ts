import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Configuration — adjust for your deployment
const MIN_DEPOSIT = ethers.parseEther("1"); // 1 kFUEL
const TIMEOUT_BLOCKS = 300; // ~10 min at ~2s/block
const MIN_REWARD = ethers.parseEther("0.1"); // 0.1 kFUEL
const MAX_REWARD = ethers.parseEther("10"); // 10 kFUEL
const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1B kFUEL
const INITIAL_VAULT_FUNDING = ethers.parseEther("1000000"); // 1M kFUEL

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== KASPLEX Testnet Deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "KAS");

  if (balance < ethers.parseEther("0.05")) {
    console.error("ERROR: Insufficient balance. Need at least 0.05 KAS for deployment gas.");
    process.exitCode = 1;
    return;
  }

  // ─── Deploy KasRacingFuel ────────────────────────────────────
  console.log("\n[1/4] Deploying KasRacingFuel...");
  const FuelFactory = await ethers.getContractFactory("KasRacingFuel");
  const fuel = await FuelFactory.deploy(INITIAL_SUPPLY, deployer.address);
  await fuel.waitForDeployment();
  const fuelAddr = await fuel.getAddress();
  console.log("  KasRacingFuel deployed:", fuelAddr);
  console.log("  Deployer kFUEL balance:", ethers.formatEther(await fuel.balanceOf(deployer.address)), "kFUEL");

  // ─── Deploy MatchEscrow ─────────────────────────────────────
  console.log("\n[2/4] Deploying MatchEscrow...");
  const EscrowFactory = await ethers.getContractFactory("MatchEscrow");
  const escrow = await EscrowFactory.deploy(fuelAddr, MIN_DEPOSIT, TIMEOUT_BLOCKS);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("  MatchEscrow deployed:", escrowAddr);

  // ─── Deploy RewardVault ─────────────────────────────────────
  console.log("\n[3/4] Deploying RewardVault...");
  const VaultFactory = await ethers.getContractFactory("RewardVault");
  const vault = await VaultFactory.deploy(fuelAddr, MIN_REWARD, MAX_REWARD);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("  RewardVault deployed:", vaultAddr);

  // ─── Fund RewardVault ───────────────────────────────────────
  console.log("\n[4/4] Funding RewardVault with", ethers.formatEther(INITIAL_VAULT_FUNDING), "kFUEL...");
  const approveTx = await fuel.approve(vaultAddr, INITIAL_VAULT_FUNDING);
  await approveTx.wait();
  const fundTx = await vault.fund(INITIAL_VAULT_FUNDING);
  await fundTx.wait();
  console.log("  Funded. Vault balance:", ethers.formatEther(await vault.vaultBalance()), "kFUEL");

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
      KasRacingFuel: fuelAddr,
      MatchEscrow: escrowAddr,
      RewardVault: vaultAddr,
    },
    config: {
      tokenSymbol: "kFUEL",
      minDepositKfuel: ethers.formatEther(MIN_DEPOSIT),
      timeoutBlocks: TIMEOUT_BLOCKS,
      minRewardKfuel: ethers.formatEther(MIN_REWARD),
      maxRewardKfuel: ethers.formatEther(MAX_REWARD),
      initialSupplyKfuel: ethers.formatEther(INITIAL_SUPPLY),
      initialVaultFundingKfuel: ethers.formatEther(INITIAL_VAULT_FUNDING),
    },
    deployedAt: new Date().toISOString(),
    blockNumber: blockNumber,
  };

  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  console.log("\n  Address registry updated:", registryPath);

  // ─── Summary ────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log("KasRacingFuel:", fuelAddr);
  console.log("MatchEscrow:", escrowAddr);
  console.log("RewardVault:", vaultAddr);
  console.log("Block:", blockNumber);
  console.log("Registry:", registryPath);
  console.log("\nVerify on explorer:");
  console.log(`  ${getExplorerUrl()}/address/${fuelAddr}`);
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
