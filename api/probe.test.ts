import { afterEach, expect, test, vi } from 'vitest';
import handler from './probe';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('exports an edge handler for the endpoint probe', () => {
  expect(handler).toBeTypeOf('function');
});

test('returns a probe result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 200, headers: { 'content-type': 'text/html' } }))
  );

  const response = await handler(
    new Request(`https://app.example/api/probe?url=${encodeURIComponent('https://example.com')}`)
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, status: 200 });
});

test('refuses a blocked host with 400', async () => {
  const response = await handler(
    new Request(`https://app.example/api/probe?url=${encodeURIComponent('http://127.0.0.1')}`)
  );

  expect(response.status).toBe(400);
});

test('rejects a missing url with 400', async () => {
  const response = await handler(new Request('https://app.example/api/probe'));

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'bad-url' });
});
