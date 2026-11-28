import { expect, test } from 'vitest';
import handler, { config } from './index';

test('exports a Node.js handler for the Vercel function', () => {
  expect(config).toEqual({ runtime: 'nodejs22.x' });
  expect(handler).toBeTypeOf('function');
});
