import { afterEach, describe, expect, test, vi } from 'vitest';
import { relayJson } from './fetchJson';

function jsonResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

function redirectResponse(location: string | null): Response {
  if (location === null) return new Response(null, { status: 302 });

  return new Response(null, { status: 302, headers: { location } });
}

function stubFetch(handler: () => Promise<Response>) {
  const mock = vi.fn(handler);
  vi.stubGlobal('fetch', mock);

  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('relayJson', () => {
  test('rejects a malformed url', async () => {
    await expect(relayJson('not a url')).resolves.toMatchObject({ status: 400 });
  });

  test('rejects non-https and private hosts without fetching', async () => {
    const fetchMock = stubFetch(async () => jsonResponse('{}'));

    await expect(relayJson('http://example.com/a')).resolves.toMatchObject({ status: 400 });
    await expect(relayJson('https://localhost/a')).resolves.toMatchObject({ status: 400 });
    await expect(relayJson('https://127.0.0.1/a')).resolves.toMatchObject({ status: 400 });
    await expect(relayJson('https://10.1.2.3/a')).resolves.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('reports an unreachable upstream', async () => {
    stubFetch(() => Promise.reject(new Error('offline')));
    await expect(relayJson('https://example.com/a.json')).resolves.toMatchObject({
      status: 502,
      body: 'Upstream unreachable',
    });
  });

  test('follows a redirect and returns JSON', async () => {
    const fetchMock = stubFetch(async () => jsonResponse('{"ok":true}'));
    fetchMock.mockResolvedValueOnce(redirectResponse('/next'));

    const result = await relayJson('https://example.com/start');

    expect(result).toMatchObject({ status: 200, body: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('stops a redirect with no location', async () => {
    stubFetch(async () => redirectResponse(null));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({ status: 502 });
  });

  test('stops a redirect with a malformed location', async () => {
    stubFetch(async () => redirectResponse('http://'));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({ status: 502 });
  });

  test('rejects a redirect to a blocked host', async () => {
    stubFetch(async () => redirectResponse('https://192.168.1.1/a'));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({ status: 400 });
  });

  test('reports upstream HTTP errors', async () => {
    stubFetch(async () => new Response('gone', { status: 404 }));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({
      status: 502,
      body: 'Upstream HTTP 404',
    });
  });

  test('rejects a declared body over the cap', async () => {
    stubFetch(
      async () => new Response('{}', { status: 200, headers: { 'content-length': '999999' } })
    );
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({ status: 413 });
  });

  test('rejects a body that grows over the cap', async () => {
    stubFetch(async () => new Response('x'.repeat(300_000), { status: 200 }));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({ status: 413 });
  });

  test('rejects a non-JSON body', async () => {
    stubFetch(async () => new Response('<html></html>', { status: 200 }));
    await expect(relayJson('https://example.com/a')).resolves.toMatchObject({
      status: 502,
      body: 'Upstream did not return JSON',
    });
  });

  test('stops after too many redirects', async () => {
    stubFetch(async () => redirectResponse('https://example.com/loop'));
    await expect(relayJson('https://example.com/loop')).resolves.toMatchObject({
      status: 502,
      body: 'Too many redirects',
    });
  });
});
