import { describe, expect, it } from 'vitest';
import { blockedResolvedUrl, systemResolver } from './dnsGuard';
import { blockedHost } from './urlGuard';

describe('blockedResolvedUrl', () => {
  it('resolves the system name for a local test host', async () => {
    const addresses = await systemResolver('localhost');

    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses.some((address) => blockedHost(address))).toBe(true);
  });

  it('allows a public address and blocks a private one', async () => {
    await expect(
      blockedResolvedUrl(new URL('https://example.com/a'), async () => ['93.184.216.34'])
    ).resolves.toBe(false);
    await expect(
      blockedResolvedUrl(new URL('https://localtest.me/a'), async () => ['127.0.0.1'])
    ).resolves.toBe(true);
  });

  it('fails closed when DNS fails or returns nothing', async () => {
    await expect(
      blockedResolvedUrl(new URL('https://example.com/a'), async () => {
        throw new Error('dns down');
      })
    ).resolves.toBe(true);
    await expect(
      blockedResolvedUrl(new URL('https://example.com/a'), async () => [])
    ).resolves.toBe(true);
  });

  it('rejects reserved hosts without asking DNS', async () => {
    let called = false;

    await expect(
      blockedResolvedUrl(new URL('https://127.0.0.1/a'), async () => {
        called = true;

        return ['93.184.216.34'];
      })
    ).resolves.toBe(true);
    expect(called).toBe(false);
  });
});
