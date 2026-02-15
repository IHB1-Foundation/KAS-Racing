import { describe, it, expect } from "vitest";
import { matchEscrowAbi, rewardVaultAbi } from "./abis.js";

describe("IndexerEVM ABIs", () => {
  it("matchEscrowAbi should have expected events", () => {
    const eventNames = matchEscrowAbi.map((e) => e.name);
    expect(eventNames).toContain("MatchCreated");
    expect(eventNames).toContain("Deposited");
    expect(eventNames).toContain("MatchFunded");
    expect(eventNames).toContain("Settled");
    expect(eventNames).toContain("Draw");
    expect(eventNames).toContain("Refunded");
    expect(eventNames).toContain("MatchCancelled");
  });

  it("rewardVaultAbi should have expected events", () => {
    const eventNames = rewardVaultAbi.map((e) => e.name);
    expect(eventNames).toContain("RewardPaid");
    expect(eventNames).toContain("ProofRecorded");
    expect(eventNames).toContain("Funded");
  });

  it("MatchCreated event should have correct inputs", () => {
    const event = matchEscrowAbi.find((e) => e.name === "MatchCreated");
    expect(event).toBeDefined();
    expect(event!.inputs).toHaveLength(5);
    expect(event!.inputs[0].name).toBe("matchId");
    expect(event!.inputs[0].indexed).toBe(true);
  });

  it("RewardPaid event should have correct inputs", () => {
    const event = rewardVaultAbi.find((e) => e.name === "RewardPaid");
    expect(event).toBeDefined();
    expect(event!.inputs).toHaveLength(5);
    expect(event!.inputs[0].name).toBe("sessionId");
    expect(event!.inputs[2].name).toBe("recipient");
  });
});

describe("Config", () => {
  it("should have default values", async () => {
    const { config } = await import("./config.js");
    expect(config.chainId).toBe(167012);
    expect(config.pollingIntervalMs).toBeGreaterThan(0);
    expect(config.batchSize).toBeGreaterThan(0);
    expect(config.reorgDepth).toBeGreaterThan(0);
  });
});
