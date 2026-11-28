import { describe, expect, it } from 'vitest';
import {
  calibrateAgents,
  scoreBand,
  spearman,
  type CalibrationAgent,
  type CalibrationConfig,
} from './calibration';
import type { Feedback } from './types';

const DAY = 86_400;
const NOW = 1_767_225_600;

function row(client: string, value: number, daysAgo: number): Feedback {
  return {
    client: client as `0x${string}`,
    value,
    tag1: 'quality',
    revoked: false,
    createdAt: NOW - daysAgo * DAY,
  };
}

function agent(id: string, value: number): CalibrationAgent {
  return {
    id,
    feedback: Array.from({ length: 8 }, (_, i) =>
      row(`0x${(100 + i).toString(16).padStart(40, '0')}`, value + (i % 3) * 2, 2 + i * 3)
    ),
  };
}

describe('spearman', () => {
  it('is 1 for the same order and -1 for the reverse', () => {
    expect(spearman([1, 2, 3], [10, 20, 30])).toBeCloseTo(1);
    expect(spearman([1, 2, 3], [30, 20, 10])).toBeCloseTo(-1);
  });

  it('uses average ranks for ties', () => {
    expect(spearman([1, 1, 2], [1, 2, 2])).toBeCloseTo(0.5, 3);
  });

  it('returns 1 when a series is constant', () => {
    expect(spearman([1, 1, 1], [3, 2, 1])).toBe(1);
  });
});

describe('scoreBand', () => {
  it('needs a non-low confidence for trusted', () => {
    expect(scoreBand(80, 'high')).toBe('trusted');
    expect(scoreBand(80, 'low')).toBe('fair');
    expect(scoreBand(39, 'high')).toBe('flagged');
    expect(scoreBand(null, 'low')).toBe('flagged');
  });
});

describe('calibrateAgents', () => {
  const agents = [agent('a', 80), agent('b', 60), agent('c', 30)];
  const configs: CalibrationConfig[] = [
    { id: 'current', label: 'Current', options: {} },
    { id: 'fast', label: 'Fast', options: { halfLifeDays: 30 } },
  ];

  it('keeps the baseline at rho 1 and counts every agent', () => {
    const result = calibrateAgents(agents, configs);
    expect(result[0]).toMatchObject({ trusted: 1, fair: 1, flagged: 1, rho: 1 });
    expect(result[1]?.rows).toHaveLength(3);
  });

  it('uses the newest row as the clock by default', () => {
    const result = calibrateAgents(agents, configs);
    expect(result[0]?.rows[0]?.score).toBeGreaterThan(70);
  });
});
