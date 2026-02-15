import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Network:", network.name, "chainId:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "KAS");

  // Placeholder: will be replaced with MatchEscrow + RewardVault in T-311/T-312
  console.log("\nDeployment complete. Update deploy/addresses.kasplex.testnet.json with contract addresses.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
