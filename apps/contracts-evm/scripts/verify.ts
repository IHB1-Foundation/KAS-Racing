import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("=== Contract Verification ===");
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const addressFile = path.resolve(__dirname, "../../../deploy/addresses.kasplex.testnet.json");

  if (!fs.existsSync(addressFile)) {
    console.error("ERROR: Address registry not found:", addressFile);
    console.error("Run deploy first: pnpm --filter @kas-racing/contracts-evm deploy:testnet");
    process.exitCode = 1;
    return;
  }

  const registry = JSON.parse(fs.readFileSync(addressFile, "utf-8"));
  console.log("Registry loaded:", JSON.stringify(registry, null, 2));

  const contracts = registry.contracts || {};
  const fuelAddress = contracts.KasRacingFuel as string | undefined;
  let allGood = true;

  for (const [name, address] of Object.entries(contracts)) {
    if (!address || address === "0x_TO_BE_DEPLOYED") {
      console.log(`\n[SKIP] ${name}: not deployed yet`);
      continue;
    }

    console.log(`\n[CHECK] ${name}: ${address}`);

    try {
      const code = await ethers.provider.getCode(address as string);
      if (code === "0x" || code === "0x0") {
        console.log(`  ❌ No contract code at address`);
        allGood = false;
      } else {
        console.log(`  ✅ Contract code found (${code.length} bytes)`);
      }

      // Check contract state
      if (name === "KasRacingFuel") {
        const fuel = await ethers.getContractAt("KasRacingFuel", address as string);
        const tokenName = await fuel.name();
        const tokenSymbol = await fuel.symbol();
        const totalSupply = await fuel.totalSupply();
        const owner = await fuel.owner();
        const ownerBalance = await fuel.balanceOf(owner);
        console.log(`  name/symbol: ${tokenName} (${tokenSymbol})`);
        console.log(`  totalSupply: ${ethers.formatEther(totalSupply)} ${tokenSymbol}`);
        console.log(`  owner: ${owner}`);
        console.log(`  ownerBalance: ${ethers.formatEther(ownerBalance)} ${tokenSymbol}`);
      }

      if (name === "MatchEscrow") {
        const escrow = await ethers.getContractAt("MatchEscrow", address as string);
        const minDeposit = await escrow.minDeposit();
        const timeoutBlocks = await escrow.timeoutBlocks();
        const token = await escrow.fuelToken();
        const owner = await escrow.owner();
        console.log(`  fuelToken: ${token}`);
        if (fuelAddress) {
          console.log(`  fuelToken matches registry: ${token.toLowerCase() === fuelAddress.toLowerCase()}`);
        }
        console.log(`  minDeposit: ${ethers.formatEther(minDeposit)} kFUEL`);
        console.log(`  timeoutBlocks: ${timeoutBlocks}`);
        console.log(`  owner: ${owner}`);
      }

      if (name === "RewardVault") {
        const vault = await ethers.getContractAt("RewardVault", address as string);
        const token = await vault.fuelToken();
        const balance = await vault.vaultBalance();
        const minReward = await vault.minReward();
        const maxReward = await vault.maxRewardPerTx();
        const totalPaid = await vault.totalPaid();
        const owner = await vault.owner();
        console.log(`  fuelToken: ${token}`);
        if (fuelAddress) {
          console.log(`  fuelToken matches registry: ${token.toLowerCase() === fuelAddress.toLowerCase()}`);
        }
        console.log(`  balance: ${ethers.formatEther(balance)} kFUEL`);
        console.log(`  minReward: ${ethers.formatEther(minReward)} kFUEL`);
        console.log(`  maxReward: ${ethers.formatEther(maxReward)} kFUEL`);
        console.log(`  totalPaid: ${ethers.formatEther(totalPaid)} kFUEL`);
        console.log(`  owner: ${owner}`);
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      allGood = false;
    }
  }

  console.log("\n=== Verification", allGood ? "PASSED" : "FAILED", "===");
  if (!allGood) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
