import { expect, test } from 'vitest';
import { formatScore } from './formatScore';

test('formats scores with two fraction digits', () => {
  expect(formatScore(0.72)).toBe('0.72');
  expect(formatScore(1)).toBe('1.00');
});
