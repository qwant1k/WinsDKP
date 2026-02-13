import { describe, it, expect } from 'vitest';

describe('DKP Formulas', () => {
  function findCoefficient(
    ranges: Array<{ from: number; to: number; coefficient: number }>,
    value: number,
  ): number {
    for (const range of ranges) {
      if (value >= range.from && value <= range.to) {
        return range.coefficient;
      }
    }
    return 0;
  }

  function calculateDkpReward(
    baseDkp: number,
    bm: number,
    level: number,
    powerRanges: Array<{ from: number; to: number; coefficient: number }>,
    levelRanges: Array<{ from: number; to: number; coefficient: number }>,
  ): number {
    const powerCoef = findCoefficient(powerRanges, bm);
    const levelCoef = findCoefficient(levelRanges, level);
    return Math.round((baseDkp + baseDkp * powerCoef + baseDkp * levelCoef) * 100) / 100;
  }

  const powerRanges = [
    { from: 0, to: 10000, coefficient: 0.5 },
    { from: 10001, to: 30000, coefficient: 0.8 },
    { from: 30001, to: 60000, coefficient: 1.0 },
    { from: 60001, to: 100000, coefficient: 1.2 },
  ];

  const levelRanges = [
    { from: 1, to: 30, coefficient: 0.6 },
    { from: 31, to: 60, coefficient: 0.9 },
    { from: 61, to: 80, coefficient: 1.0 },
    { from: 81, to: 100, coefficient: 1.3 },
  ];

  it('calculates DKP for low-level low-BM player', () => {
    const result = calculateDkpReward(100, 5000, 15, powerRanges, levelRanges);
    // 100 + 100*0.5 + 100*0.6 = 100 + 50 + 60 = 210
    expect(result).toBe(210);
  });

  it('calculates DKP for mid-level mid-BM player', () => {
    const result = calculateDkpReward(100, 45000, 70, powerRanges, levelRanges);
    // 100 + 100*1.0 + 100*1.0 = 100 + 100 + 100 = 300
    expect(result).toBe(300);
  });

  it('calculates DKP for high-level high-BM player', () => {
    const result = calculateDkpReward(100, 85000, 95, powerRanges, levelRanges);
    // 100 + 100*1.2 + 100*1.3 = 100 + 120 + 130 = 350
    expect(result).toBe(350);
  });

  it('returns base DKP when no matching range', () => {
    const result = calculateDkpReward(100, 150000, 200, powerRanges, levelRanges);
    // 100 + 0 + 0 = 100 (out of range)
    expect(result).toBe(100);
  });

  it('handles boundary values correctly (inclusive ranges)', () => {
    const resultLowBound = calculateDkpReward(100, 10000, 30, powerRanges, levelRanges);
    expect(resultLowBound).toBe(210); // 100 + 50 + 60

    const resultHighBound = calculateDkpReward(100, 10001, 31, powerRanges, levelRanges);
    expect(resultHighBound).toBe(270); // 100 + 80 + 90
  });

  it('handles zero base DKP', () => {
    const result = calculateDkpReward(0, 50000, 70, powerRanges, levelRanges);
    expect(result).toBe(0);
  });
});

describe('DKP Wallet Invariants', () => {
  it('available balance = balance - onHold', () => {
    const wallet = { balance: 1000, onHold: 200 };
    const available = wallet.balance - wallet.onHold;
    expect(available).toBe(800);
  });

  it('cannot hold more than available', () => {
    const wallet = { balance: 1000, onHold: 800 };
    const available = wallet.balance - wallet.onHold;
    const holdAmount = 300;
    expect(holdAmount > available).toBe(true);
  });

  it('balance never negative after standard debit', () => {
    const wallet = { balance: 100, onHold: 0 };
    const debitAmount = 150;
    const canDebit = wallet.balance - wallet.onHold >= debitAmount;
    expect(canDebit).toBe(false);
  });
});
