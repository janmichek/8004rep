import { describe, expect, test } from 'vitest';
import type { ProbeResult } from '../probe';
import { statusOf } from './probe';

function result(error?: ProbeResult['error']): ProbeResult {
  const probe: ProbeResult = {
    ok: false,
    status: null,
    latencyMs: null,
    contentType: null,
    finalUrl: 'https://example.com',
    checkedAt: 1,
  };

  if (error !== undefined) probe.error = error;

  return probe;
}

describe('statusOf', () => {
  test('400 for a request that cannot be attempted', () => {
    expect(statusOf(result('bad-url'))).toBe(400);
    expect(statusOf(result('url-too-long'))).toBe(400);
    expect(statusOf(result('blocked-url'))).toBe(400);
  });

  test('200 for an upstream outcome', () => {
    expect(statusOf(result('unreachable'))).toBe(200);
    expect(statusOf(result())).toBe(200);
  });
});
