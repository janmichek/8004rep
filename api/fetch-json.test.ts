import { afterEach, expect, test, vi } from 'vitest';
import handler, { config } from './fetch-json';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('exports an edge handler for the JSON relay', () => {
  expect(config).toEqual({ runtime: 'edge' });
  expect(handler).toBeTypeOf('function');
});

test('relays a public JSON document', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
  );

  const response = await handler(
    new Request(
      `https://app.example/api/fetch-json?url=${encodeURIComponent('https://example.com/a.json')}`
    )
  );

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('{"ok":true}');
});

test('refuses a blocked host', async () => {
  const response = await handler(
    new Request(
      `https://app.example/api/fetch-json?url=${encodeURIComponent('https://localhost/a.json')}`
    )
  );

  expect(response.status).toBe(400);
});
