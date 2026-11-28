import { describe, expect, it } from 'vitest';
import { canonicalJson, hashEvidence, sha256Hex } from './contentHash';

describe('canonicalJson', () => {
  it('sorts keys at every level', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      '{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}'
    );
  });

  it('keeps array order', () => {
    expect(canonicalJson([2, 1, { b: 0, a: 1 }])).toBe('[2,1,{"a":1,"b":0}]');
  });
});

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 vector for "abc"', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
});

describe('hashEvidence', () => {
  it('hashes the same content regardless of key order', async () => {
    const a = await hashEvidence({ b: 1, a: 2 });
    const b = await hashEvidence({ a: 2, b: 1 });
    expect(a.value).toBe(b.value);
    expect(a.algorithm).toBe('sha256');
  });
});
