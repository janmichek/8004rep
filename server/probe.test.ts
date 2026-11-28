import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeUrl } from './probe';

function response(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe('probeUrl', () => {
  it('reports status, latency and content type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(200, { 'content-type': 'application/json' }))
    );
    const result = await probeUrl('https://probe-ok.example/health');
    expect(result).toMatchObject({ ok: true, status: 200, contentType: 'application/json' });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('keeps a non-2xx answer as a result, not a throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(503))
    );
    await expect(probeUrl('https://probe-503.example/health')).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it('follows a redirect and reports the final URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(302, { location: '/next' }))
      .mockResolvedValueOnce(response(200));

    vi.stubGlobal('fetch', fetchMock);
    const result = await probeUrl('https://probe-redirect.example/start');
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      finalUrl: 'https://probe-redirect.example/next',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses a private host before fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(probeUrl('http://127.0.0.1/health')).resolves.toMatchObject({
      error: 'blocked-url',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an unreachable host and a bad URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline')))
    );
    await expect(probeUrl('https://probe-down.example/health')).resolves.toMatchObject({
      error: 'unreachable',
    });
    await expect(probeUrl('not a url')).resolves.toMatchObject({ error: 'bad-url' });
  });

  it('rejects a URL longer than the cap', async () => {
    const long = `https://probe-long.example/${'a'.repeat(2_100)}`;
    await expect(probeUrl(long)).resolves.toMatchObject({ error: 'url-too-long' });
  });

  it('rejects a redirect with no location at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(302))
    );
    await expect(probeUrl('https://probe-no-redirect.example/start')).resolves.toMatchObject({
      error: 'bad-redirect',
    });
  });

  it('rejects a redirect without a usable location', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(302, { location: 'http://[bad' }))
    );
    await expect(probeUrl('https://probe-bad-redirect.example/start')).resolves.toMatchObject({
      error: 'bad-redirect',
    });
  });

  it('stops after the redirect budget', async () => {
    const fetchMock = vi.fn(async () => response(302, { location: '/again' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(probeUrl('https://probe-loop.example/start')).resolves.toMatchObject({
      error: 'too-many-redirects',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('serves the second call from the cache', async () => {
    const fetchMock = vi.fn(async () => response(200));
    vi.stubGlobal('fetch', fetchMock);
    await probeUrl('https://probe-cached.example/health');
    await probeUrl('https://probe-cached.example/health');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
