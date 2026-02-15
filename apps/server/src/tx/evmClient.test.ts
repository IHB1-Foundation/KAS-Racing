import { describe, it, expect } from "vitest";
import { kasplexTestnet } from "./evmClient.js";
import { matchEscrowAbi, rewardVaultAbi } from "./evmAbis.js";
import { toMatchId, toSessionId, buildProofHash } from "./evmContracts.js";
import { keccak256, toBytes } from "viem";

describe("EVM Client", () => {
  it("should define kasplex testnet chain", () => {
    expect(kasplexTestnet.id).toBe(167012);
    expect(kasplexTestnet.name).toBe("KASPLEX zkEVM Testnet");
    expect(kasplexTestnet.nativeCurrency.symbol).toBe("KAS");
    expect(kasplexTestnet.nativeCurrency.decimals).toBe(18);
  });
});

describe("EVM ABIs", () => {
  it("matchEscrowAbi should have expected functions", () => {
    const names = matchEscrowAbi
      .filter((item) => item.type === "function")
      .map((item) => item.name);
    expect(names).toContain("createMatch");
    expect(names).toContain("settle");
    expect(names).toContain("settleDraw");
    expect(names).toContain("cancel");
    expect(names).toContain("getMatch");
    expect(names).toContain("getMatchState");
  });

  it("rewardVaultAbi should have expected functions", () => {
    const names = rewardVaultAbi
      .filter((item) => item.type === "function")
      .map((item) => item.name);
    expect(names).toContain("payReward");
    expect(names).toContain("isPaid");
    expect(names).toContain("vaultBalance");
    expect(names).toContain("totalPaid");
  });
});

describe("EVM Contracts utilities", () => {
  it("toMatchId should produce deterministic bytes32", () => {
    const id1 = toMatchId("match-001");
    const id2 = toMatchId("match-001");
    const id3 = toMatchId("match-002");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.startsWith("0x")).toBe(true);
    expect(id1.length).toBe(66); // 0x + 64 hex chars
  });

  it("toSessionId should produce deterministic bytes32", () => {
    const id = toSessionId("session-abc");
    expect(id.length).toBe(66);
    expect(id).toBe(keccak256(toBytes("session-abc")));
  });

  it("buildProofHash should encode game event data", () => {
    const hash = buildProofHash({
      network: "testnet",
      mode: "freerun",
      sessionId: "sess-001",
      event: "checkpoint",
      seq: 1,
    });
    expect(hash.length).toBe(66);

    // Same inputs → same hash
    const hash2 = buildProofHash({
      network: "testnet",
      mode: "freerun",
      sessionId: "sess-001",
      event: "checkpoint",
      seq: 1,
    });
    expect(hash).toBe(hash2);

    // Different seq → different hash
    const hash3 = buildProofHash({
      network: "testnet",
      mode: "freerun",
      sessionId: "sess-001",
      event: "checkpoint",
      seq: 2,
    });
    expect(hash).not.toBe(hash3);
  });
});
