import { expect } from "chai";
import { ethers } from "hardhat";
import { RewardVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RewardVault", function () {
  const MIN_REWARD = ethers.parseEther("0.001");
  const MAX_REWARD = ethers.parseEther("0.1");
  const REWARD_AMOUNT = ethers.parseEther("0.005");
  const VAULT_FUNDING = ethers.parseEther("1.0");
  const SESSION_ID = ethers.keccak256(ethers.toUtf8Bytes("session-001"));
  const PROOF_HASH = ethers.keccak256(ethers.toUtf8Bytes("checkpoint-event-data"));
  const PAYLOAD = ethers.toUtf8Bytes("KASRACE1|testnet|freerun|session-001|checkpoint|1|abc123");

  let vault: RewardVault;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let player: SignerWithAddress;
  let outsider: SignerWithAddress;

  beforeEach(async function () {
    [owner, operator, player, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RewardVault");
    vault = await Factory.deploy(MIN_REWARD, MAX_REWARD);
    await vault.setOperator(operator.address, true);

    // Fund the vault
    await owner.sendTransaction({ to: await vault.getAddress(), value: VAULT_FUNDING });
  });

  // ─── Funding ───────────────────────────────────────────────
  describe("Funding", function () {
    it("should accept direct funding", async function () {
      expect(await vault.vaultBalance()).to.equal(VAULT_FUNDING);
    });

    it("should emit Funded event", async function () {
      const amount = ethers.parseEther("0.5");
      await expect(
        owner.sendTransaction({ to: await vault.getAddress(), value: amount })
      ).to.emit(vault, "Funded").withArgs(owner.address, amount);
    });
  });

  // ─── Reward Payment ────────────────────────────────────────
  describe("Reward Payment", function () {
    it("should pay reward to player", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.emit(vault, "RewardPaid")
        .withArgs(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH);
    });

    it("should increase player balance", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.changeEtherBalance(player, REWARD_AMOUNT);
    });

    it("should emit ProofRecorded when payload provided", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.emit(vault, "ProofRecorded");
    });

    it("should not emit ProofRecorded when payload is empty", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, "0x")
      ).to.not.emit(vault, "ProofRecorded");
    });

    it("should track total paid and payouts", async function () {
      await vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);
      await vault.connect(operator).payReward(SESSION_ID, 2, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);

      expect(await vault.totalPaid()).to.equal(REWARD_AMOUNT * 2n);
      expect(await vault.totalPayouts()).to.equal(2);
    });
  });

  // ─── Idempotency (Duplicate Prevention) ────────────────────
  describe("Idempotency", function () {
    it("should reject duplicate (sessionId, seq)", async function () {
      await vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);

      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "AlreadyPaid");
    });

    it("should allow same session with different seq", async function () {
      await vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);
      await vault.connect(operator).payReward(SESSION_ID, 2, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);

      expect(await vault.isPaid(SESSION_ID, 1)).to.be.true;
      expect(await vault.isPaid(SESSION_ID, 2)).to.be.true;
    });

    it("should allow different session with same seq", async function () {
      const session2 = ethers.keccak256(ethers.toUtf8Bytes("session-002"));
      await vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);
      await vault.connect(operator).payReward(session2, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD);

      expect(await vault.isPaid(SESSION_ID, 1)).to.be.true;
      expect(await vault.isPaid(session2, 1)).to.be.true;
    });

    it("isPaid should return false for unpaid key", async function () {
      expect(await vault.isPaid(SESSION_ID, 99)).to.be.false;
    });
  });

  // ─── Validation ────────────────────────────────────────────
  describe("Validation", function () {
    it("should reject below minimum reward", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, MIN_REWARD - 1n, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "BelowMinReward");
    });

    it("should reject above maximum reward", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, MAX_REWARD + 1n, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "AboveMaxReward");
    });

    it("should reject zero address recipient", async function () {
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, ethers.ZeroAddress, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("should reject when vault has insufficient balance", async function () {
      // Deploy new vault without funding
      const Factory = await ethers.getContractFactory("RewardVault");
      const emptyVault = await Factory.deploy(MIN_REWARD, MAX_REWARD);
      await emptyVault.setOperator(operator.address, true);

      await expect(
        emptyVault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(emptyVault, "InsufficientBalance");
    });
  });

  // ─── Access Control ────────────────────────────────────────
  describe("Access Control", function () {
    it("should reject non-operator payReward", async function () {
      await expect(
        vault.connect(outsider).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "NotOperator");
    });

    it("should reject non-owner setOperator", async function () {
      await expect(
        vault.connect(outsider).setOperator(outsider.address, true)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("should pause and block payouts", async function () {
      await vault.pause();
      await expect(
        vault.connect(operator).payReward(SESSION_ID, 1, player.address, REWARD_AMOUNT, PROOF_HASH, PAYLOAD)
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");
    });
  });

  // ─── Withdraw ──────────────────────────────────────────────
  describe("Withdraw", function () {
    it("owner should be able to withdraw", async function () {
      const amount = ethers.parseEther("0.5");
      await expect(vault.withdraw(amount)).to.changeEtherBalance(owner, amount);
    });

    it("should reject withdraw exceeding balance", async function () {
      await expect(
        vault.withdraw(VAULT_FUNDING + 1n)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("should reject non-owner withdraw", async function () {
      await expect(
        vault.connect(outsider).withdraw(ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });
});
