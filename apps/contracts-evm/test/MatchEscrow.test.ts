import { expect } from "chai";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { MatchEscrow } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MatchEscrow", function () {
  const DEPOSIT = ethers.parseEther("0.01");
  const MIN_DEPOSIT = ethers.parseEther("0.001");
  const TIMEOUT_BLOCKS = 100;
  const MATCH_ID = ethers.keccak256(ethers.toUtf8Bytes("match-001"));

  let escrow: MatchEscrow;
  let owner: SignerWithAddress;
  let operator: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let outsider: SignerWithAddress;

  beforeEach(async function () {
    [owner, operator, player1, player2, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MatchEscrow");
    escrow = await Factory.deploy(MIN_DEPOSIT, TIMEOUT_BLOCKS);
    await escrow.setOperator(operator.address, true);
  });

  async function createMatch(matchId = MATCH_ID) {
    await escrow.connect(operator).createMatch(matchId, player1.address, player2.address, DEPOSIT);
  }

  async function fundMatch(matchId = MATCH_ID) {
    await createMatch(matchId);
    await escrow.connect(player1).deposit(matchId, { value: DEPOSIT });
    await escrow.connect(player2).deposit(matchId, { value: DEPOSIT });
  }

  // ─── Match Creation ────────────────────────────────────────
  describe("Match Creation", function () {
    it("should create a match", async function () {
      await createMatch();
      const m = await escrow.getMatch(MATCH_ID);
      expect(m.player1).to.equal(player1.address);
      expect(m.player2).to.equal(player2.address);
      expect(m.depositAmount).to.equal(DEPOSIT);
      expect(m.state).to.equal(0); // Created
    });

    it("should emit MatchCreated event", async function () {
      await expect(
        escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT)
      ).to.emit(escrow, "MatchCreated");
    });

    it("should reject duplicate match IDs", async function () {
      await createMatch();
      await expect(createMatch()).to.be.revertedWithCustomError(escrow, "MatchExists");
    });

    it("should reject non-operator", async function () {
      await expect(
        escrow.connect(outsider).createMatch(MATCH_ID, player1.address, player2.address, DEPOSIT)
      ).to.be.revertedWithCustomError(escrow, "NotOperator");
    });

    it("should reject deposit below minimum", async function () {
      await expect(
        escrow.connect(operator).createMatch(MATCH_ID, player1.address, player2.address, MIN_DEPOSIT - 1n)
      ).to.be.revertedWith("Below min deposit");
    });

    it("should reject same player as both sides", async function () {
      await expect(
        escrow.connect(operator).createMatch(MATCH_ID, player1.address, player1.address, DEPOSIT)
      ).to.be.revertedWith("Same player");
    });
  });

  // ─── Deposits ──────────────────────────────────────────────
  describe("Deposits", function () {
    beforeEach(async function () {
      await createMatch();
    });

    it("should accept player1 deposit", async function () {
      await expect(escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT }))
        .to.emit(escrow, "Deposited")
        .withArgs(MATCH_ID, player1.address, DEPOSIT);

      expect(await escrow.isDeposited(MATCH_ID, player1.address)).to.be.true;
    });

    it("should move to Funded after both deposits", async function () {
      await escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT });
      await expect(escrow.connect(player2).deposit(MATCH_ID, { value: DEPOSIT }))
        .to.emit(escrow, "MatchFunded");

      expect(await escrow.getMatchState(MATCH_ID)).to.equal(1); // Funded
    });

    it("should reject wrong deposit amount", async function () {
      await expect(
        escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT + 1n })
      ).to.be.revertedWithCustomError(escrow, "WrongDepositAmount");
    });

    it("should reject double deposit", async function () {
      await escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT });
      await expect(
        escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT })
      ).to.be.revertedWithCustomError(escrow, "AlreadyDeposited");
    });

    it("should reject outsider deposit", async function () {
      await expect(
        escrow.connect(outsider).deposit(MATCH_ID, { value: DEPOSIT })
      ).to.be.revertedWithCustomError(escrow, "NotPlayer");
    });
  });

  // ─── Settlement ────────────────────────────────────────────
  describe("Settlement", function () {
    beforeEach(async function () {
      await fundMatch();
    });

    it("should pay winner the full pot", async function () {
      const payout = DEPOSIT * 2n;
      await expect(escrow.connect(operator).settle(MATCH_ID, player1.address))
        .to.emit(escrow, "Settled")
        .withArgs(MATCH_ID, player1.address, payout);

      expect(await escrow.getMatchState(MATCH_ID)).to.equal(2); // Settled
    });

    it("should increase winner balance by 2x deposit", async function () {
      await expect(
        escrow.connect(operator).settle(MATCH_ID, player1.address)
      ).to.changeEtherBalance(player1, DEPOSIT * 2n);
    });

    it("should handle draw — refund both players", async function () {
      await expect(escrow.connect(operator).settleDraw(MATCH_ID))
        .to.emit(escrow, "Draw")
        .withArgs(MATCH_ID, player1.address, player2.address, DEPOSIT);
    });

    // ── Theft Resistance ──
    it("THEFT: should reject settlement to third-party address", async function () {
      await expect(
        escrow.connect(operator).settle(MATCH_ID, outsider.address)
      ).to.be.revertedWithCustomError(escrow, "InvalidWinner");
    });

    it("THEFT: should reject settlement by non-operator", async function () {
      await expect(
        escrow.connect(outsider).settle(MATCH_ID, outsider.address)
      ).to.be.revertedWithCustomError(escrow, "NotOperator");
    });

    it("should reject settling unfunded match", async function () {
      const id2 = ethers.keccak256(ethers.toUtf8Bytes("match-002"));
      await escrow.connect(operator).createMatch(id2, player1.address, player2.address, DEPOSIT);
      await expect(
        escrow.connect(operator).settle(id2, player1.address)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("should reject settling already-settled match", async function () {
      await escrow.connect(operator).settle(MATCH_ID, player1.address);
      await expect(
        escrow.connect(operator).settle(MATCH_ID, player2.address)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  // ─── Timeout Refund ────────────────────────────────────────
  describe("Timeout Refund", function () {
    it("should refund after timeout (partially funded)", async function () {
      await createMatch();
      await escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT });

      // Mine past timeout
      await mine(TIMEOUT_BLOCKS + 1);

      await expect(escrow.connect(player1).refund(MATCH_ID))
        .to.emit(escrow, "Refunded")
        .withArgs(MATCH_ID, player1.address, DEPOSIT);
    });

    it("should refund both players after timeout (fully funded)", async function () {
      await fundMatch();

      await mine(TIMEOUT_BLOCKS + 1);

      await expect(escrow.connect(player1).refund(MATCH_ID))
        .to.changeEtherBalance(player1, DEPOSIT);
      await expect(escrow.connect(player2).refund(MATCH_ID))
        .to.changeEtherBalance(player2, DEPOSIT);

      expect(await escrow.getMatchState(MATCH_ID)).to.equal(3); // Refunded
    });

    it("should reject refund before timeout", async function () {
      await createMatch();
      await escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT });

      await expect(
        escrow.connect(player1).refund(MATCH_ID)
      ).to.be.revertedWith("Timeout not reached");
    });

    it("should reject refund by outsider", async function () {
      await createMatch();
      await mine(TIMEOUT_BLOCKS + 1);

      await expect(
        escrow.connect(outsider).refund(MATCH_ID)
      ).to.be.revertedWithCustomError(escrow, "NotPlayer");
    });
  });

  // ─── Cancel ────────────────────────────────────────────────
  describe("Cancel", function () {
    it("should cancel and refund deposited player", async function () {
      await createMatch();
      await escrow.connect(player1).deposit(MATCH_ID, { value: DEPOSIT });

      await expect(escrow.connect(operator).cancel(MATCH_ID))
        .to.emit(escrow, "MatchCancelled");

      expect(await escrow.getMatchState(MATCH_ID)).to.equal(4); // Cancelled
    });

    it("should reject cancel of funded match", async function () {
      await fundMatch();
      await expect(
        escrow.connect(operator).cancel(MATCH_ID)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("should reject cancel by non-operator", async function () {
      await createMatch();
      await expect(
        escrow.connect(outsider).cancel(MATCH_ID)
      ).to.be.revertedWithCustomError(escrow, "NotOperator");
    });
  });

  // ─── Access Control ────────────────────────────────────────
  describe("Access Control", function () {
    it("owner should be able to add/remove operators", async function () {
      await escrow.setOperator(outsider.address, true);
      expect(await escrow.operators(outsider.address)).to.be.true;

      await escrow.setOperator(outsider.address, false);
      expect(await escrow.operators(outsider.address)).to.be.false;
    });

    it("non-owner should not be able to add operators", async function () {
      await expect(
        escrow.connect(outsider).setOperator(outsider.address, true)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("should pause and unpause", async function () {
      await escrow.pause();
      await expect(createMatch()).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.unpause();
      await createMatch(); // should work
    });
  });
});
