import { describe, expect, test } from 'vitest';
import { createTtlCache } from './cache';

function fakeClock(start = 0) {
  let time = start;

  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('createTtlCache', () => {
  test('returns a value until its TTL expires', () => {
    const clock = fakeClock();
    const cache = createTtlCache<string>(1_000, 10, clock.now);

    cache.set('agent', 'Atlas');

    expect(cache.get('agent')).toBe('Atlas');

    clock.advance(999);

    expect(cache.get('agent')).toBe('Atlas');

    clock.advance(1);

    expect(cache.get('agent')).toBeUndefined();
    expect(cache.get('agent')).toBeUndefined();
  });

  test('evicts the oldest entry when full', () => {
    const clock = fakeClock();
    const cache = createTtlCache<string>(1_000, 2, clock.now);

    cache.set('a', 'one');
    cache.set('b', 'two');
    cache.set('c', 'three');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('two');
    expect(cache.get('c')).toBe('three');
  });

  test('overwriting a key keeps the other entries', () => {
    const clock = fakeClock();
    const cache = createTtlCache<string>(1_000, 2, clock.now);

    cache.set('a', 'one');
    cache.set('b', 'two');
    cache.set('b', 'updated');

    expect(cache.get('a')).toBe('one');
    expect(cache.get('b')).toBe('updated');
  });
});
