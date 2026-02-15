import { describe, it, expect } from 'vitest';
import { computeOdds, type RaceTelemetry } from './oddsEngineService.js';

describe('computeOdds', () => {
  const base: RaceTelemetry = {
    player1Distance: 100,
    player1Speed: 200,
    player2Distance: 100,
    player2Speed: 200,
    elapsedMs: 15000,
    totalDurationMs: 30000,
  };

  it('returns 50/50 when both players are equal', () => {
    const result = computeOdds(base);
    expect(result.probABps + result.probBBps).toBe(10000);
    expect(result.probABps).toBe(5000);
    expect(result.probBBps).toBe(5000);
  });

  it('returns 50/50 when no distance traveled', () => {
    const result = computeOdds({ ...base, player1Distance: 0, player2Distance: 0 });
    expect(result.probABps).toBe(5000);
    expect(result.probBBps).toBe(5000);
  });

  it('favors player 1 when ahead in distance', () => {
    const result = computeOdds({ ...base, player1Distance: 200, player2Distance: 100 });
    expect(result.probABps).toBeGreaterThan(5000);
    expect(result.probBBps).toBeLessThan(5000);
    expect(result.probABps + result.probBBps).toBe(10000);
  });

  it('favors player 2 when ahead in distance', () => {
    const result = computeOdds({ ...base, player1Distance: 50, player2Distance: 200 });
    expect(result.probABps).toBeLessThan(5000);
    expect(result.probBBps).toBeGreaterThan(5000);
  });

  it('speed has less weight late in race', () => {
    // Early race: speed matters more
    const early = computeOdds({
      ...base,
      player1Distance: 100,
      player2Distance: 100,
      player1Speed: 400,
      player2Speed: 200,
      elapsedMs: 1000,
    });

    // Late race: speed matters less
    const late = computeOdds({
      ...base,
      player1Distance: 100,
      player2Distance: 100,
      player1Speed: 400,
      player2Speed: 200,
      elapsedMs: 28000,
    });

    // Both should favor player 1 (faster), but early more so
    expect(early.probABps).toBeGreaterThan(5000);
    expect(late.probABps).toBeGreaterThan(5000);
    expect(early.probABps).toBeGreaterThan(late.probABps);
  });

  it('clamps probabilities to [5%, 95%]', () => {
    // Extreme advantage
    const result = computeOdds({
      ...base,
      player1Distance: 1000,
      player2Distance: 1,
      player1Speed: 600,
      player2Speed: 10,
      elapsedMs: 29000,
    });
    expect(result.probABps).toBeLessThanOrEqual(9500);
    expect(result.probBBps).toBeGreaterThanOrEqual(500);
  });

  it('always sums to 10000 bps', () => {
    const scenarios: RaceTelemetry[] = [
      { ...base, player1Distance: 300, player2Distance: 50 },
      { ...base, player1Distance: 1, player2Distance: 999 },
      { ...base, elapsedMs: 0 },
      { ...base, elapsedMs: 30000 },
    ];

    for (const scenario of scenarios) {
      const result = computeOdds(scenario);
      expect(result.probABps + result.probBBps).toBe(10000);
    }
  });

  it('is deterministic for same inputs', () => {
    const result1 = computeOdds(base);
    const result2 = computeOdds(base);
    expect(result1.probABps).toBe(result2.probABps);
    expect(result1.probBBps).toBe(result2.probBBps);
  });
});
