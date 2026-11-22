import { describe, expect, test } from 'vitest';
import type { Agent } from '@shared/schemas';
import { averageScore, byNetwork, countByStatus } from './roster';

function agent(status: Agent['status'], score: number | null, network = 'BASE'): Agent {
  return {
    id: 0,
    network,
    name: 'Test Agent',
    owner: '0x1111111111111111111111111111111111111111',
    feedbackCount: 0,
    score,
    status,
    registeredAt: '2025-01-06T09:14:00Z',
  };
}

const roster = [
  agent('active', 0.8),
  agent('quiet', 0.4),
  agent('unreviewed', null),
  agent('active', 0.6, 'ARB'),
];

describe('byNetwork', () => {
  test('keeps every agent when no network is picked', () => {
    expect(byNetwork(roster, undefined)).toBe(roster);
  });

  test('keeps only agents on the picked network', () => {
    expect(byNetwork(roster, 'ARB')).toEqual([roster[3]]);
  });
});

describe('countByStatus', () => {
  test('counts every status, including ones with no agents', () => {
    expect(countByStatus(roster)).toEqual({ active: 2, quiet: 1, unreviewed: 1 });
    expect(countByStatus([])).toEqual({ active: 0, quiet: 0, unreviewed: 0 });
  });
});

describe('averageScore', () => {
  test('averages known scores only', () => {
    expect(averageScore(roster)).toBeCloseTo(0.6);
  });

  test('returns null when no scores exist', () => {
    expect(averageScore([agent('unreviewed', null)])).toBeNull();
  });
});
