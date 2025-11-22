import { expect } from "chai";
import { ethers } from "hardhat";
import { X402Guard, X402GuardFactory, MockUSDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("X402Guard", function () {
  let usdc: MockUSDC;
  let factory: X402GuardFactory;
  let guard: X402Guard;
  let owner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;

  // Policy settings (6 decimals for USDC)
  const maxPerTx = ethers.parseUnits("5", 6);      // $5
  const dailyLimit = ethers.parseUnits("50", 6);   // $50
  const approvalThreshold = ethers.parseUnits("2", 6); // $2

  beforeEach(async function () {
    [owner, agent, recipient] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("X402GuardFactory");
    factory = await Factory.deploy(await usdc.getAddress());

    // Create Guard via factory
    await factory.createGuard(
      agent.address,
      maxPerTx,
      dailyLimit,
      approvalThreshold
    );

    const guards = await factory.getGuardsByOwner(owner.address);
    guard = await ethers.getContractAt("X402Guard", guards[0]);

    // Fund the guard
    const fundAmount = ethers.parseUnits("100", 6);
    await usdc.approve(await guard.getAddress(), fundAmount);
    await guard.fund(fundAmount);

    // Allow all endpoints for testing
    await guard.setAllowAllEndpoints(true);
  });

  describe("Deployment", function () {
    it("Should set correct owner", async function () {
      expect(await guard.owner()).to.equal(owner.address);
    });

    it("Should set correct agent", async function () {
      expect(await guard.agent()).to.equal(agent.address);
    });

    it("Should set correct policies", async function () {
      expect(await guard.maxPerTransaction()).to.equal(maxPerTx);
      expect(await guard.dailyLimit()).to.equal(dailyLimit);
      expect(await guard.approvalThreshold()).to.equal(approvalThreshold);
    });

    it("Should have correct balance", async function () {
      expect(await guard.getBalance()).to.equal(ethers.parseUnits("100", 6));
    });
  });

  describe("Payment Execution", function () {
    const endpointHash = ethers.keccak256(ethers.toUtf8Bytes("https://api.test.com"));

    it("Should execute payment within limits", async function () {
      const amount = ethers.parseUnits("1", 6); // $1

      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, endpointHash)
      ).to.emit(guard, "PaymentExecuted");

      expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
      expect(await guard.dailySpent()).to.equal(amount);
    });

    it("Should reject payment exceeding per-tx limit", async function () {
      const amount = ethers.parseUnits("10", 6); // $10 > $5 limit

      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, endpointHash)
      ).to.be.revertedWithCustomError(guard, "ExceedsPerTransactionLimit");
    });

    it("Should reject payment exceeding daily limit", async function () {
      const amount = ethers.parseUnits("4", 6); // $4 per tx

      // Make 12 payments of $4 = $48, should work
      for (let i = 0; i < 12; i++) {
        await guard.connect(agent).executePayment(recipient.address, amount, endpointHash);
      }

      // 13th payment would be $52 > $50 daily limit
      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, endpointHash)
      ).to.be.revertedWithCustomError(guard, "ExceedsDailyLimit");
    });

    it("Should require approval above threshold", async function () {
      const amount = ethers.parseUnits("3", 6); // $3 > $2 threshold

      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, endpointHash)
      ).to.be.revertedWithCustomError(guard, "RequiresApproval");
    });

    it("Should reject non-agent callers", async function () {
      const amount = ethers.parseUnits("1", 6);

      await expect(
        guard.connect(recipient).executePayment(recipient.address, amount, endpointHash)
      ).to.be.revertedWithCustomError(guard, "NotAgent");
    });
  });

  describe("Endpoint Allowlist", function () {
    const allowedHash = ethers.keccak256(ethers.toUtf8Bytes("https://allowed.api.com"));
    const blockedHash = ethers.keccak256(ethers.toUtf8Bytes("https://blocked.api.com"));

    beforeEach(async function () {
      // Disable allow-all and set specific allowlist
      await guard.setAllowAllEndpoints(false);
      await guard.setEndpointAllowed(allowedHash, true);
    });

    it("Should allow payment to allowed endpoint", async function () {
      const amount = ethers.parseUnits("1", 6);
      
      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, allowedHash)
      ).to.emit(guard, "PaymentExecuted");
    });

    it("Should reject payment to blocked endpoint", async function () {
      const amount = ethers.parseUnits("1", 6);

      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, blockedHash)
      ).to.be.revertedWithCustomError(guard, "EndpointNotAllowed");
    });

    it("Should allow setting endpoint by URL", async function () {
      await guard.setEndpointAllowedByUrl("https://new.api.com", true);
      
      const newHash = ethers.keccak256(ethers.toUtf8Bytes("https://new.api.com"));
      expect(await guard.allowedEndpoints(newHash)).to.be.true;
    });
  });

  describe("Approval Flow", function () {
    const endpointHash = ethers.keccak256(ethers.toUtf8Bytes("https://api.test.com"));
    const amount = ethers.parseUnits("3", 6); // $3 > $2 threshold

    it("Should queue payment for approval", async function () {
      await expect(
        guard.connect(agent).executePayment(recipient.address, amount, endpointHash)
      ).to.be.revertedWithCustomError(guard, "RequiresApproval");

      // Check pending payment was created
      const pending = await guard.getPendingPayment(0);
      expect(pending.to).to.equal(recipient.address);
      expect(pending.amount).to.equal(amount);
      expect(pending.executed).to.be.false;
    });

    it("Should allow owner to approve payment", async function () {
      // First, trigger the queuing
      try {
        await guard.connect(agent).executePayment(recipient.address, amount, endpointHash);
      } catch (e) {
        // Expected to revert with RequiresApproval
      }

      // Owner approves
      await expect(guard.connect(owner).approvePayment(0))
        .to.emit(guard, "PaymentApproved")
        .to.emit(guard, "PaymentExecuted");

      expect(await usdc.balanceOf(recipient.address)).to.equal(amount);
    });

    it("Should allow owner to reject payment", async function () {
      try {
        await guard.connect(agent).executePayment(recipient.address, amount, endpointHash);
      } catch (e) {}

      await expect(guard.connect(owner).rejectPayment(0))
        .to.emit(guard, "PaymentRejected");

      const pending = await guard.getPendingPayment(0);
      expect(pending.rejected).to.be.true;
    });
  });

  describe("Policy Management", function () {
    it("Should allow owner to update policies", async function () {
      const newMaxPerTx = ethers.parseUnits("10", 6);
      const newDailyLimit = ethers.parseUnits("100", 6);
      const newThreshold = ethers.parseUnits("5", 6);

      await expect(guard.setPolicy(newMaxPerTx, newDailyLimit, newThreshold))
        .to.emit(guard, "PolicyUpdated");

      expect(await guard.maxPerTransaction()).to.equal(newMaxPerTx);
      expect(await guard.dailyLimit()).to.equal(newDailyLimit);
      expect(await guard.approvalThreshold()).to.equal(newThreshold);
    });

    it("Should allow owner to change agent", async function () {
      await expect(guard.setAgent(recipient.address))
        .to.emit(guard, "AgentUpdated");

      expect(await guard.agent()).to.equal(recipient.address);
    });

    it("Should reject non-owner policy changes", async function () {
      await expect(
        guard.connect(agent).setPolicy(0, 0, 0)
      ).to.be.revertedWithCustomError(guard, "OwnableUnauthorizedAccount");
    });
  });

  describe("Withdrawals", function () {
    it("Should allow owner to withdraw", async function () {
      const withdrawAmount = ethers.parseUnits("50", 6);
      const balanceBefore = await usdc.balanceOf(owner.address);

      await guard.withdraw(withdrawAmount);

      expect(await usdc.balanceOf(owner.address)).to.equal(balanceBefore + withdrawAmount);
      expect(await guard.getBalance()).to.equal(ethers.parseUnits("50", 6));
    });

    it("Should allow owner to withdraw all", async function () {
      await guard.withdrawAll();
      expect(await guard.getBalance()).to.equal(0);
    });
  });
});
