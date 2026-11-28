import type { RegistrationFile, Service } from './types';
import { jaccardSets } from './similarity';

// Public gateways that send CORS headers. ipfs.io and dweb.link rate-limit hard (429), so they go last.
const IPFS_GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
];
const FETCH_TIMEOUT_MS = 8000;
/** A list page resolves a file per row; more parallel requests than this get gateways to throttle us. */
const MAX_CONCURRENT_FETCHES = 6;

/** `ipfs://<cid>/path` and `ipfs://ipfs/<cid>/path` → `<cid>/path`. */
function ipfsPath(uri: string): string {
  return uri.slice('ipfs://'.length).replace(/^ipfs\//, '');
}

/**
 * URL safe to put in `href`/`src`, or undefined. Registration files are
 * untrusted, so only http(s), ipfs (via gateway) and inline images pass.
 */
export function toDisplayUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  if (s.startsWith('ipfs://')) return IPFS_GATEWAYS[0] + ipfsPath(s);
  if (/^data:image\//i.test(s)) return s;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts current `services[]` entries and legacy `endpoints[]` ones (`type`/`value`/`meta.version`). */
function toService(item: unknown): Service | undefined {
  if (!isRecord(item)) return undefined;
  const name = str(item['name']) ?? str(item['type']);
  const endpoint = str(item['endpoint']) ?? str(item['value']);
  if (!name || !endpoint) return undefined;
  const meta = item['meta'];
  const version = str(item['version']) ?? (isRecord(meta) ? str(meta['version']) : undefined);
  return { name, endpoint, ...(version ? { version } : {}) };
}

/** Null when `json` is not a registration object; never throws. */
export function normalizeRegistrationFile(json: unknown): RegistrationFile | null {
  if (!isRecord(json)) return null;
  const services = Array.isArray(json['services']) ? json['services'] : json['endpoints'];
  const trust = Array.isArray(json['supportedTrust'])
    ? json['supportedTrust']
    : json['trustModels'];
  return {
    name: str(json['name']),
    description: str(json['description']),
    image: str(json['image']),
    active: bool(json['active']),
    x402Support: bool(json['x402Support']) ?? bool(json['x402support']),
    version: str(json['version']),
    services: Array.isArray(services) ? services.flatMap((s) => toService(s) ?? []) : [],
    supportedTrust: Array.isArray(trust) ? trust.flatMap((t) => str(t) ?? []) : [],
    raw: json,
  };
}

type Coding = 'gzip' | 'deflate';

/** Content coding declared in the media-type parameters: `;enc=gzip` or the older `;gzip`. */
function declaredCoding(params: string): Coding | undefined {
  const match = /;\s*(?:enc=)?(gzip|deflate)\b/i.exec(params);
  return match ? (match[1]!.toLowerCase() as Coding) : undefined;
}

/** A payload that was compressed without saying so: gzip magic, or a zlib header passing the mod-31 check. */
function sniffCoding(bytes: Uint8Array): Coding | undefined {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if (bytes[0] === 0x78 && ((bytes[0]! << 8) | (bytes[1] ?? 0)) % 31 === 0) return 'deflate';
  return undefined;
}

async function inflate(bytes: Uint8Array, coding: Coding): Promise<Uint8Array> {
  // Copy into a plain ArrayBuffer so the body type is BodyInit under TS's Uint8Array<ArrayBufferLike>.
  const body = new Response(new Uint8Array(bytes).buffer).body;
  if (!body) return bytes;
  return new Uint8Array(
    await new Response(body.pipeThrough(new DecompressionStream(coding))).arrayBuffer()
  );
}

async function decodeDataUri(uri: string): Promise<unknown> {
  const match = /^data:([^,]*),(.*)$/is.exec(uri);
  if (!match) return null;
  const [, params = '', payload = ''] = match;
  // Registration/feedback files are JSON; an empty media type (`data:,{…}`) is still one.
  const mediaType = params.split(';')[0]!.trim().toLowerCase();
  if (mediaType && mediaType !== 'application/json') return null;
  const bytes = /;base64/i.test(params)
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  // Files like `data:application/json;enc=gzip;base64,H4sI…` hash as served but
  // must be inflated before parsing; `fetchUriBytes` keeps the raw bytes for that.
  const coding = declaredCoding(params) ?? sniffCoding(bytes);
  return JSON.parse(new TextDecoder().decode(coding ? await inflate(bytes, coding) : bytes));
}

let activeFetches = 0;
const waitingFetches: (() => void)[] = [];

/** Runs `task` once one of the {@link MAX_CONCURRENT_FETCHES} slots is free. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  // A finishing task hands its slot straight to the next waiter.
  if (activeFetches >= MAX_CONCURRENT_FETCHES)
    await new Promise<void>((resolve) => waitingFetches.push(resolve));
  else activeFetches++;
  try {
    return await task();
  } finally {
    const next = waitingFetches.shift();
    if (next) next();
    else activeFetches--;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    // A TypeError is how the browser reports a CORS block: retry via our relay.
    if (!(err instanceof TypeError) || !/^https:/i.test(url)) throw err;
    res = await fetch(`${import.meta.env.BASE_URL}api/fetch-json?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Index of the gateway that answered last; tried first next time. */
let preferredGateway = 0;

/** Tries the gateways in turn, starting with the one that answered last. */
async function fetchIpfs<T>(uri: string, get: (url: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const index = (preferredGateway + i) % IPFS_GATEWAYS.length;
    try {
      const body = await get(IPFS_GATEWAYS[index] + ipfsPath(uri));
      preferredGateway = index;
      return body;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function load(uri: string): Promise<unknown> {
  if (/^data:/i.test(uri)) return decodeDataUri(uri);
  if (uri.startsWith('ipfs://')) return limited(() => fetchIpfs(uri, fetchJson));
  if (/^https?:\/\//i.test(uri)) return limited(() => fetchJson(uri));
  return null;
}

const jsonCache = new Map<string, Promise<unknown>>();

/**
 * Fetches the JSON behind a `data:` / `ipfs://` / `https://` URI, cached by
 * URI and shared across at most MAX_CONCURRENT_FETCHES requests. Rejects on
 * unreachable hosts, CORS failures and bad JSON; failures are not cached.
 */
export function fetchJsonUri(uri: string | null | undefined): Promise<unknown> {
  const key = uri?.trim();
  if (!key) return Promise.resolve(null);
  const cached = jsonCache.get(key);
  if (cached) return cached;
  const pending = load(key);
  jsonCache.set(key, pending);
  // Failures may be transient (gateway timeout); only keep successes.
  void pending.then(
    () => {},
    () => jsonCache.delete(key)
  );
  return pending;
}

/** Payload of any `data:` URI, base64 or percent-encoded. */
function dataUriBytes(uri: string): Uint8Array {
  const match = /^data:([^,]*),(.*)$/is.exec(uri);
  if (!match) throw new Error('Malformed data: URI');
  const [, params = '', payload = ''] = match;
  return /;base64/i.test(params)
    ? Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
}

/**
 * The exact bytes behind a `data:` / `ipfs://` / `https://` URI, for
 * hashing against a commitment. Not cached; rejects on unsupported
 * schemes, unreachable hosts and CORS failures.
 */
export async function fetchUriBytes(uri: string): Promise<Uint8Array> {
  const key = uri.trim();
  if (/^data:/i.test(key)) return dataUriBytes(key);
  if (key.startsWith('ipfs://')) return limited(() => fetchIpfs(key, fetchBytes));
  if (/^https?:\/\//i.test(key)) return limited(() => fetchBytes(key));
  throw new Error('Unsupported URI scheme');
}

const cache = new Map<string, Promise<RegistrationFile | null>>();

/**
 * Fetches and normalizes the registration file behind an agent URI.
 * Null when there is no URI, the scheme is unsupported, or it cannot be
 * fetched/parsed (unreachable host, CORS, bad JSON). Never rejects.
 */
export function resolveAgentURI(uri: string | null | undefined): Promise<RegistrationFile | null> {
  const key = uri?.trim();
  if (!key) return Promise.resolve(null);
  const cached = cache.get(key);
  if (cached) return cached;
  const pending = fetchJsonUri(key).then(normalizeRegistrationFile, () => null);
  cache.set(key, pending);
  // Failures may be transient (gateway timeout); only keep successes.
  void pending.then((file) => {
    if (!file) cache.delete(key);
  });
  return pending;
}

/**
 * Comment behind a feedback URI (`text`, legacy `comment`, or `reasoning`).
 * Undefined when absent, not a string, or unreachable. Never rejects.
 */
export function resolveFeedbackText(uri: string | null | undefined): Promise<string | undefined> {
  return fetchJsonUri(uri).then(
    (json) =>
      isRecord(json)
        ? (str(json['text']) ?? str(json['comment']) ?? str(json['reasoning']))
        : undefined,
    () => undefined
  );
}

/** One field of a registration file and whether it is usable. */
export type RegistrationCheck = {
  id: 'name' | 'description' | 'services' | 'version';
  label: string;
  ok: boolean;
  detail: string;
};

export type RegistrationCompleteness = {
  passed: number;
  total: number;
  checks: RegistrationCheck[];
};

function isServiceEndpoint(value: string): boolean {
  if (value.startsWith('ipfs://')) return value.length > 'ipfs://'.length;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * What a registration file actually provides, in four checkable parts. This is
 * a profile-quality indicator, not a score input: good metadata cannot buy a
 * reputation, and missing metadata does not erase one.
 */
export function registrationCompleteness(
  file: RegistrationFile | null | undefined
): RegistrationCompleteness {
  if (!file) {
    return {
      passed: 0,
      total: 4,
      checks: [
        { id: 'name', label: 'Name', ok: false, detail: 'No registration file loaded.' },
        {
          id: 'description',
          label: 'Description',
          ok: false,
          detail: 'No registration file loaded.',
        },
        { id: 'services', label: 'Services', ok: false, detail: 'No registration file loaded.' },
        { id: 'version', label: 'Version', ok: false, detail: 'No registration file loaded.' },
      ],
    };
  }
  const description = file.description?.trim() ?? '';
  const endpointOk = file.services.filter((service) => isServiceEndpoint(service.endpoint));
  const checks: RegistrationCheck[] = [
    {
      id: 'name',
      label: 'Name',
      ok: Boolean(file.name?.trim()),
      detail: file.name?.trim() ? file.name : 'No name.',
    },
    {
      id: 'description',
      label: 'Description',
      ok: description.length >= 40,
      detail: description
        ? description.length >= 40
          ? `${description.length} characters.`
          : `${description.length} characters; 40+ says what the agent does.`
        : 'No description.',
    },
    {
      id: 'services',
      label: 'Services',
      ok: file.services.length > 0 && endpointOk.length === file.services.length,
      detail:
        file.services.length === 0
          ? 'No services advertised.'
          : `${endpointOk.length} of ${file.services.length} endpoints are http(s) or ipfs.`,
    },
    {
      id: 'version',
      label: 'Version',
      ok: Boolean(file.version?.trim()),
      detail: file.version?.trim() ?? 'No version field.',
    },
  ];
  return { passed: checks.filter((check) => check.ok).length, total: checks.length, checks };
}

const CLONE_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'your',
  'you',
  'are',
  'was',
  'has',
  'have',
  'agent',
  'service',
  'services',
  'endpoint',
  'https',
  'http',
  'www',
  'com',
  'io',
  'ai',
]);

/** Words that describe a registration file, for near-duplicate detection. */
export function metadataTokens(file: RegistrationFile): Set<string> {
  const text = [
    file.name ?? '',
    file.description ?? '',
    ...file.services.flatMap((service) => [service.name, service.endpoint]),
  ].join(' ');
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9._-]{2,}/g) ?? [];
  return new Set(tokens.filter((token) => !CLONE_STOPWORDS.has(token)));
}

export type MetadataCloneGroup = {
  tokenIds: bigint[];
  /** Weakest pair in the group, 0–1. */
  similarity: number;
  /** Tokens at least two members share. */
  shared: string[];
};

/** Agents whose registration text is near-identical (Jaccard ≥ threshold). */
export function findMetadataClones(
  entries: readonly { tokenId: bigint; file?: RegistrationFile | null | undefined }[],
  threshold = 0.8
): MetadataCloneGroup[] {
  const sets = entries
    .filter((entry): entry is { tokenId: bigint; file: RegistrationFile } => Boolean(entry.file))
    .map((entry) => ({ tokenId: entry.tokenId, tokens: metadataTokens(entry.file) }))
    .filter((entry) => entry.tokens.size > 0);
  const parent = new Map<string, string>();
  const keyOf = (tokenId: bigint) => tokenId.toString();
  for (const entry of sets) parent.set(keyOf(entry.tokenId), keyOf(entry.tokenId));
  const find = (key: string): string => {
    const parentKey = parent.get(key)!;
    return parentKey === key ? key : find(parentKey);
  };
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      if (jaccardSets(sets[i]!.tokens, sets[j]!.tokens) >= threshold) {
        const a = find(keyOf(sets[i]!.tokenId));
        const b = find(keyOf(sets[j]!.tokenId));
        if (a !== b) parent.set(b, a);
      }
    }
  }
  const groups = new Map<string, typeof sets>();
  for (const entry of sets) {
    const root = find(keyOf(entry.tokenId));
    const group = groups.get(root);
    if (group) group.push(entry);
    else groups.set(root, [entry]);
  }
  return [...groups.values()]
    .filter((group) => group.length >= 2)
    .map((group) => {
      const shared = [...group[0]!.tokens].filter((token) =>
        group.every((member) => member.tokens.has(token))
      );
      return {
        tokenIds: group.map((member) => member.tokenId),
        similarity: Math.min(
          ...group.flatMap((member, i) =>
            group.slice(i + 1).map((other) => jaccardSets(member.tokens, other.tokens))
          )
        ),
        shared,
      };
    })
    .sort((a, b) => b.tokenIds.length - a.tokenIds.length);
}
