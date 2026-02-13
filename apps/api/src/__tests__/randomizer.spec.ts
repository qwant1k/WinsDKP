import { describe, it, expect } from 'vitest';
import * as crypto from 'crypto';

describe('Randomizer Algorithm', () => {
  function calculateBonus(
    bm: number,
    level: number,
    maxBm: number,
    minBm: number,
    maxLevel: number,
    minLevel: number,
  ): number {
    const bmNorm = maxBm > minBm ? (maxBm - bm) / (maxBm - minBm) : 0.5;
    const levelNorm = maxLevel > minLevel ? (maxLevel - level) / (maxLevel - minLevel) : 0.5;
    return 0.03 + ((bmNorm + levelNorm) / 2) * (0.05 - 0.03);
  }

  function calculateWeight(bonus: number): number {
    return 1 + bonus;
  }

  function runDraw(
    entries: Array<{ userId: string; weight: number }>,
    seed: string,
  ): { winnerId: string; rollValue: number } {
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    const seedBuffer = Buffer.from(seed, 'hex');
    const hash = crypto.createHash('sha256').update(seedBuffer).digest();
    const rollValue = hash.readUInt32BE(0) / 0xffffffff;

    let cumulative = 0;
    let winner = entries[0]!;
    for (const entry of entries) {
      cumulative += entry.weight / totalWeight;
      if (rollValue <= cumulative) {
        winner = entry;
        break;
      }
    }

    return { winnerId: winner.userId, rollValue };
  }

  it('bonus is in range [0.03, 0.05]', () => {
    const bonus1 = calculateBonus(100000, 100, 100000, 5000, 100, 15);
    expect(bonus1).toBeGreaterThanOrEqual(0.03);
    expect(bonus1).toBeLessThanOrEqual(0.05);

    const bonus2 = calculateBonus(5000, 15, 100000, 5000, 100, 15);
    expect(bonus2).toBeGreaterThanOrEqual(0.03);
    expect(bonus2).toBeLessThanOrEqual(0.05);
  });

  it('lower BM/level gets higher bonus', () => {
    const bonusLow = calculateBonus(5000, 15, 100000, 5000, 100, 15);
    const bonusHigh = calculateBonus(100000, 100, 100000, 5000, 100, 15);
    expect(bonusLow).toBeGreaterThan(bonusHigh);
  });

  it('weight = 1 + bonus', () => {
    const bonus = 0.04;
    expect(calculateWeight(bonus)).toBe(1.04);
  });

  it('draw is deterministic with same seed', () => {
    const seed = crypto.randomBytes(32).toString('hex');
    const entries = [
      { userId: 'a', weight: 1.05 },
      { userId: 'b', weight: 1.03 },
      { userId: 'c', weight: 1.04 },
    ];

    const result1 = runDraw(entries, seed);
    const result2 = runDraw(entries, seed);

    expect(result1.winnerId).toBe(result2.winnerId);
    expect(result1.rollValue).toBe(result2.rollValue);
  });

  it('different seeds produce different results (probabilistic)', () => {
    const entries = [
      { userId: 'a', weight: 1.05 },
      { userId: 'b', weight: 1.03 },
      { userId: 'c', weight: 1.04 },
      { userId: 'd', weight: 1.035 },
      { userId: 'e', weight: 1.045 },
    ];

    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const seed = crypto.randomBytes(32).toString('hex');
      const result = runDraw(entries, seed);
      results.add(result.winnerId);
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it('all weights equal means uniform distribution', () => {
    const entries = [
      { userId: 'a', weight: 1.04 },
      { userId: 'b', weight: 1.04 },
      { userId: 'c', weight: 1.04 },
    ];

    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10000; i++) {
      const seed = crypto.randomBytes(32).toString('hex');
      const result = runDraw(entries, seed);
      counts[result.winnerId]!++;
    }

    for (const count of Object.values(counts)) {
      expect(count).toBeGreaterThan(2500);
      expect(count).toBeLessThan(4500);
    }
  });
});

describe('Anti-Sniper Logic', () => {
  function shouldExtendTimer(
    bidTimeMs: number,
    lotEndsAtMs: number,
    antiSniperEnabled: boolean,
    antiSniperSeconds: number,
  ): boolean {
    if (!antiSniperEnabled) return false;
    const secondsLeft = (lotEndsAtMs - bidTimeMs) / 1000;
    return secondsLeft <= antiSniperSeconds && secondsLeft > 0;
  }

  it('extends when bid is in last N seconds', () => {
    const now = Date.now();
    const endsAt = now + 15000; // 15 seconds left
    expect(shouldExtendTimer(now, endsAt, true, 20)).toBe(true);
  });

  it('does not extend when bid is before anti-sniper window', () => {
    const now = Date.now();
    const endsAt = now + 60000; // 60 seconds left
    expect(shouldExtendTimer(now, endsAt, true, 20)).toBe(false);
  });

  it('does not extend when anti-sniper is disabled', () => {
    const now = Date.now();
    const endsAt = now + 5000;
    expect(shouldExtendTimer(now, endsAt, false, 20)).toBe(false);
  });

  it('does not extend when lot already ended', () => {
    const now = Date.now();
    const endsAt = now - 1000;
    expect(shouldExtendTimer(now, endsAt, true, 20)).toBe(false);
  });

  it('extends at exact boundary (N seconds)', () => {
    const now = Date.now();
    const endsAt = now + 20000;
    expect(shouldExtendTimer(now, endsAt, true, 20)).toBe(true);
  });
});
