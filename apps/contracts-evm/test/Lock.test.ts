import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Lock", function () {
  async function deployLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000n;

    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    const lockedAmount = ONE_GWEI;

    const [owner, otherAccount] = await ethers.getSigners();
    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

    return { lock, unlockTime, lockedAmount, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("should set the right unlockTime", async function () {
      const { lock, unlockTime } = await deployLockFixture();
      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("should set the right owner", async function () {
      const { lock, owner } = await deployLockFixture();
      expect(await lock.owner()).to.equal(owner.address);
    });

    it("should receive and store the funds", async function () {
      const { lock, lockedAmount } = await deployLockFixture();
      expect(await ethers.provider.getBalance(await lock.getAddress())).to.equal(lockedAmount);
    });

    it("should fail if unlockTime is not in the future", async function () {
      const latestTime = await time.latest();
      const Lock = await ethers.getContractFactory("Lock");
      await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
        "Unlock time must be in the future"
      );
    });
  });

  describe("Withdrawals", function () {
    it("should revert with Too early if called before unlock time", async function () {
      const { lock } = await deployLockFixture();
      await expect(lock.withdraw()).to.be.revertedWith("Too early");
    });

    it("should revert if called by non-owner", async function () {
      const { lock, unlockTime, otherAccount } = await deployLockFixture();
      await time.increaseTo(unlockTime);
      await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith("Not the owner");
    });

    it("should transfer the funds to the owner", async function () {
      const { lock, unlockTime, lockedAmount, owner } = await deployLockFixture();
      await time.increaseTo(unlockTime);
      await expect(lock.withdraw()).to.changeEtherBalance(owner, lockedAmount);
    });

    it("should emit Withdrawal event", async function () {
      const { lock, unlockTime, lockedAmount } = await deployLockFixture();
      await time.increaseTo(unlockTime);
      await expect(lock.withdraw())
        .to.emit(lock, "Withdrawal")
        .withArgs(lockedAmount, unlockTime + 1);
    });
  });
});
