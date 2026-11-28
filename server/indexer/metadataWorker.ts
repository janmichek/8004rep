import { z } from 'zod';
import {
  decodeDataUri,
  parseRegistrationText,
  type ParsedRegistration,
} from '../../shared/metadata/parseRegistration';
import { relayJson } from '../fetchJson';
import { blockedUrl } from '../urlGuard';

export type PendingMetadata = {
  chainId: number;
  tokenId: string;
  agentUri: string;
  attempts: number;
};

export type MetadataStore = {
  pendingMetadata(limit: number): Promise<PendingMetadata[]>;
  saveMetadata(agent: PendingMetadata, parsed: ParsedRegistration): Promise<void>;
  saveMetadataError(agent: PendingMetadata, error: string, retryAt: number): Promise<void>;
};

export type Relay = (url: string) => Promise<{ status: number; body: string }>;

type FetchOptions = { relay: Relay; ipfsGateways?: readonly string[] };

export type MetadataWorkerOptions = {
  store: MetadataStore;
  /** Unix seconds. */
  now: number;
  limit?: number;
  relay?: Relay;
  ipfsGateways?: readonly string[];
};

/** Retry ladder in minutes: 5m, 30m, 2h, 12h, 48h. */
export const RETRY_MINUTES = [5, 30, 120, 720, 2880] as const;

// Public gateways that send CORS headers; ipfs.io and dweb.link rate-limit hard.
export const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
] as const;

const ERRORS = z.union([
  z.string().transform((message) => ({ message })),
  z
    .object({ message: z.string().optional() })
    .loose()
    .transform((value) => ({
      message: value.message ?? 'unknown error',
    })),
]);

function errorMessage(cause: unknown): string {
  const parsed = ERRORS.safeParse(cause);

  return parsed.success ? parsed.data.message : 'unknown error';
}

function ipfsPath(uri: string): string {
  return uri.slice('ipfs://'.length).replace(/^ipfs\//, '');
}

async function relayText(url: string, relay: Relay): Promise<string> {
  const response = await relay(url);

  if (response.status !== 200) throw new Error(`metadata answered ${response.status}`);

  return response.body;
}

async function fetchHttps(uri: string, relay: Relay): Promise<ParsedRegistration> {
  const url = new URL(uri);

  if (blockedUrl(url)) throw new Error('blocked url');
  const parsed = parseRegistrationText(await relayText(url.href, relay));

  if (!parsed) throw new Error('not a registration file');

  return parsed;
}

async function fetchIpfs(
  uri: string,
  relay: Relay,
  gateways: readonly string[]
): Promise<ParsedRegistration> {
  const path = ipfsPath(uri);
  let lastError = 'no ipfs gateway answered';

  for (const gateway of gateways) {
    try {
      const parsed = parseRegistrationText(await relayText(`${gateway}${path}`, relay));

      if (parsed) return parsed;
      lastError = 'not a registration file';
    } catch (cause) {
      lastError = errorMessage(cause);
    }
  }

  throw new Error(lastError);
}

/**
 * Resolves one registration URI. `data:` files decode locally, `ipfs://` rotates
 * through public gateways, and `https://` goes through the SSRF-guarded relay.
 */
export async function fetchRegistration(
  uri: string,
  options: { relay: Relay; ipfsGateways?: readonly string[] }
): Promise<ParsedRegistration> {
  if (uri.startsWith('data:')) {
    const parsed = await decodeDataUri(uri);

    if (!parsed) throw new Error('not a registration file');

    return parsed;
  }

  if (uri.startsWith('ipfs://')) {
    return fetchIpfs(uri, options.relay, options.ipfsGateways ?? IPFS_GATEWAYS);
  }

  if (uri.startsWith('https://')) return fetchHttps(uri, options.relay);

  throw new Error(`unsupported URI scheme: ${uri.slice(0, 24)}`);
}

function retryAt(attempts: number, now: number): number {
  const index = Math.min(Math.max(0, attempts - 1), RETRY_MINUTES.length - 1);
  const minutes = RETRY_MINUTES[index] ?? 60;

  return now + minutes * 60;
}

/** One poll of the metadata queue; failures back off instead of blocking the queue. */
export async function runMetadataBatch(
  options: MetadataWorkerOptions
): Promise<{ pending: number; saved: number; failed: number }> {
  const relay = options.relay ?? relayJson;
  const pending = await options.store.pendingMetadata(options.limit ?? 20);
  let saved = 0;
  let failed = 0;

  const fetchOptions: FetchOptions = { relay };

  if (options.ipfsGateways) fetchOptions.ipfsGateways = options.ipfsGateways;

  for (const agent of pending) {
    try {
      const parsed = await fetchRegistration(agent.agentUri, fetchOptions);

      await options.store.saveMetadata(agent, parsed);
      saved++;
    } catch (cause) {
      await options.store.saveMetadataError(
        agent,
        errorMessage(cause),
        retryAt(agent.attempts + 1, options.now)
      );
      failed++;
    }
  }

  return { pending: pending.length, saved, failed };
}
