import { lookup } from 'node:dns/promises';
import { blockedHost, blockedUrl } from './urlGuard';

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

/** Resolves through the system resolver; tests inject a deterministic fake. */
export const systemResolver: HostResolver = async (hostname) => {
  const addresses = await lookup(hostname, { all: true });

  return addresses.map((entry) => entry.address);
};

/**
 * Blocks a URL when its hostname is reserved *or* resolves to a private
 * address. Lookup failure is treated as blocked; a public hostname whose DNS
 * later changes is not pinned, so the caller must still run behind a network
 * egress policy.
 */
export async function blockedResolvedUrl(
  url: URL,
  resolve: HostResolver = systemResolver
): Promise<boolean> {
  if (blockedUrl(url)) return true;

  try {
    const addresses = await resolve(url.hostname);

    return addresses.length === 0 || addresses.some((address) => blockedHost(address));
  } catch {
    return true;
  }
}
