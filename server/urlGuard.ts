const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^198\.(18|19)\./,
  /^(22[4-9]|2[3-5]\d)\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/** Hosts the server must never fetch on behalf of a browser. */
export function blockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0') return true;

  return PRIVATE_IPV4.some((pattern) => pattern.test(host)) || host.includes(':');
}

/**
 * True when `url` is not safe to fetch. `protocols` is the allow-list; the
 * relay uses https only, while the endpoint probe accepts http as well.
 */
export function blockedUrl(url: URL, protocols: readonly string[] = ['https:']): boolean {
  return !protocols.includes(url.protocol) || blockedHost(url.hostname);
}
