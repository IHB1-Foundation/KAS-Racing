import { expect } from "chai";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { MatchEscrow, RewardVault, KasRacingFuel } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Security Baseline", function () {
  const DEPOSIT = ethers.parseEther("10");
  const MIN_DEPOSIT = ethers.parseEther("1");
  const MIN_REWARD = ethers.parseEther("0.1");
  const MAX_REWARD = ethers.parseEther("10");
  const TIMEOUT_BLOCKS = 100;
  const MATCH_ID = ethers.keccak256(ethers.toUtf8Bytes("sec-match-001"));
  const SESSION_ID = ethers.keccak256(ethers.toUtf8Bytes("sec-session-001"));
  const PROOF_HASH = ethers.keccak256(ethers.toUtf8Bytes("sec-proof"));
  const PAYLOAD = ethers.toUtf8Bytes("KASRACE1|testnet|freerun|sec-session-001|checkpoint|1|abc");

  let fuel: KasRacingFuel;
  let escrow: MatchEscrow;
  let vault: RewardVault;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let attacker: SignerWithAddress;

  beforeEach(async function () {
    [owner, operator, player1, player2, attacker] = await ethers.getSigners();

    const FuelFactory = await ethers.getContractFactory("KasRacingFuel");
    fuel = await FuelFactory.deploy(0n, owner.address);
    await fuel.mint(owner.address, ethers.parseEther("1000000"));
    await fuel.mint(player1.address, DEPOSIT * 20n);
    await fuel.mint(player2.address, DEPOSIT * 20n);

    const EscrowFactory = await ethers.getContractFactory("MatchEscrow");
    escrow = await EscrowFactory.deploy(await fuel.getAddress(), MIN_DEPOSIT, TIMEOUT_BLOCKS);
    await escrow.setOperator(operator.address, true);

    await fuel.connect(player1).approve(await escrow.getAddress(), ethers.MaxUint256);
    await fuel.connect(player2).approve(await escrow.getAddress(), ethers.MaxUint256);

    const VaultFactory = await ethers.getContractFactory("RewardVault");
    vault = await VaultFactory.deploy(await fuel.getAddress(), MIN_REWARD, MAX_REWARD);
    await vault.setOperator(operator.address, true);
    await fuel.approve(await vault.getAddress(), ethers.parseEther("1000"));
    await vault.fund(ethers.parseEther("1000"));
  });

  describe("Reentrancy Protection", function () {
    it("MatchEscrow.settle should not allow extra payout attempts", async function () {
      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attackerContract = await AttackerFactory.deploy(await escrow.getAddress(), await fuel.getAddress());
      const attackerAddr = await attackerContract.getAddress();

      await fuel.mint(attackerAddr, DEPOSIT);

      const matchId = ethers.keccak256(ethers.toUtf8Bytes("reentrancy-test"));
      await escrow.connect(operator).createMatch(matchId, attackerAddr, player2.address, DEPOSIT);
      await attackerContract.setMatchId(matchId);

      await attackerContract.deposit(matchId);
      await escrow.connect(player2).deposit(matchId);

      await escrow.connect(operator).settle(matchId, attackerAddr);

      expect(await fuel.balanceOf(await escrow.getAddress())).to.equal(0n);
      expect(await fuel.balanceOf(attackerAddr)).to.equal(DEPOSIT * 2n);
    });

    it("MatchEscrow.refund should not allow multiple refunds", async function () {
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("reentrancy-refund"));

      const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
      const attackerContract = await AttackerFactory.deploy(await escrow.getAddress(), await fuel.getAddress());
      const attackerAddr = await attackerContract.getAddress();

      await fuel.mint(attackerAddr, DEPOSIT);
      await escrow.connect(operator).createMatch(matchId, attackerAddr, player2.address, DEPOSIT);
      await attackerContract.setMatchId(matchId);
      await attackerContract.deposit(matchId);

      await mine(TIMEOUT_BLOCKS + 1);

      await attackerContract.connect(attacker).attemptReenter();
      expect(await fuel.balanceOf(await escrow.getAddress())).to.equal(0n);
    });
  });

  describe("Replay Protection", function () {
    it("should not allow settling same match twice", async function () {
      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      await escrow.connect(player1).deposit(MATCH_ID);
      await escrow.connect(player2).deposit(MATCH_ID);

      await escrow.connect(operator).settle(MATCH_ID, player1.address);

      await expect(
        escrow.connect(operator).settle(MATCH_ID, player1.address),
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("should not allow depositing after settlement", async function () {
      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      await escrow.connect(player1).deposit(MATCH_ID);
      await escrow.connect(player2).deposit(MATCH_ID);
      await escrow.connect(operator).settle(MATCH_ID, player1.address);

      await expect(
        escrow.connect(player1).deposit(MATCH_ID),
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("RewardVault replay: same key always rejected", async function () {
      const amount = ethers.parseEther("1");
      await vault.connect(operator).payReward(SESSION_ID, 1, player1.address, amount, PROOF_HASH, PAYLOAD);

      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player1.address, ethers.parseEther("2"), PROOF_HASH, PAYLOAD),
      ).to.be.revertedWithCustomError(vault, "AlreadyPaid");

      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player2.address, amount, PROOF_HASH, PAYLOAD),
      ).to.be.revertedWithCustomError(vault, "AlreadyPaid");
    });
  });

  describe("Access Control Escalation", function () {
    it("removed operator cannot settle", async function () {
      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      await escrow.connect(player1).deposit(MATCH_ID);
      await escrow.connect(player2).deposit(MATCH_ID);

      await escrow.setOperator(operator.address, false);

      await expect(
        escrow.connect(operator).settle(MATCH_ID, player1.address),
      ).to.be.revertedWithCustomError(escrow, "NotOperator");
    });

    it("removed operator cannot pay rewards", async function () {
      await vault.setOperator(operator.address, false);

      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player1.address, ethers.parseEther("1"), PROOF_HASH, PAYLOAD),
      ).to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("player cannot call admin functions", async function () {
      await expect(
        escrow.connect(player1).setOperator(player1.address, true),
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

      await expect(
        escrow.connect(player1).pause(),
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");

      await expect(
        vault.connect(player1).withdraw(1),
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("Pause Behavior", function () {
    it("paused escrow blocks createMatch and deposit", async function () {
      await escrow.pause();

      await expect(
        escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT),
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("paused vault blocks payReward", async function () {
      await vault.pause();

      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player1.address, ethers.parseEther("1"), PROOF_HASH, PAYLOAD),
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });

    it("unpause restores functionality", async function () {
      await escrow.pause();
      await escrow.unpause();

      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      expect(await escrow.getMatchState(MATCH_ID)).to.equal(0);
    });
  });

  describe("Gas Snapshots", function () {
    it("MatchEscrow.createMatch gas", async function () {
      const tx = await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      const receipt = await tx.wait();
      console.log(`    createMatch gas: ${receipt!.gasUsed}`);
      expect(receipt!.gasUsed).to.be.lessThan(220_000n);
    });

    it("MatchEscrow.deposit gas", async function () {
      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      const tx = await escrow.connect(player1).deposit(MATCH_ID);
      const receipt = await tx.wait();
      console.log(`    deposit gas: ${receipt!.gasUsed}`);
      expect(receipt!.gasUsed).to.be.lessThan(220_000n);
    });

    it("MatchEscrow.settle gas", async function () {
      await escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT);
      await escrow.connect(player1).deposit(MATCH_ID);
      await escrow.connect(player2).deposit(MATCH_ID);
      const tx = await escrow.connect(operator).settle(MATCH_ID, player1.address);
      const receipt = await tx.wait();
      console.log(`    settle gas: ${receipt!.gasUsed}`);
      expect(receipt!.gasUsed).to.be.lessThan(180_000n);
    });

    it("RewardVault.payReward gas", async function () {
      const tx = await vault.connect(operator).payReward(
        SESSION_ID,
        1,
        player1.address,
        ethers.parseEther("1"),
        PROOF_HASH,
        PAYLOAD,
      );
      const receipt = await tx.wait();
      console.log(`    payReward gas: ${receipt!.gasUsed}`);
      expect(receipt!.gasUsed).to.be.lessThan(200_000n);
    });
  });
});
