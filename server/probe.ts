import { blockedUrl } from './urlGuard';

const TIMEOUT_MS = 8_000;
const MAX_HOPS = 3;
const MAX_URL_LENGTH = 2_048;
const CACHE_TTL_MS = 5 * 60_000;

/** What a browser needs to know about one advertised endpoint. */
export type ProbeResult = {
  ok: boolean;
  status: number | null;
  /** Time to response headers, in milliseconds. */
  latencyMs: number | null;
  contentType: string | null;
  finalUrl: string;
  checkedAt: number;
  error?:
    | 'bad-url'
    | 'url-too-long'
    | 'blocked-url'
    | 'unreachable'
    | 'bad-redirect'
    | 'too-many-redirects'
    | undefined;
};

const cache = new Map<string, { at: number; result: ProbeResult }>();

function failure(error: ProbeResult['error'], finalUrl: string, checkedAt: number): ProbeResult {
  return {
    ok: false,
    status: null,
    latencyMs: null,
    contentType: null,
    finalUrl,
    checkedAt,
    error,
  };
}

type Hop = { result: ProbeResult } | { next: URL };

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // A body that cannot be cancelled is already gone.
  }
}

function redirectHop(response: Response, current: URL, checkedAt: number): Hop {
  const location = response.headers.get('location');

  if (!location) return { result: failure('bad-redirect', current.href, checkedAt) };

  try {
    return { next: new URL(location, current) };
  } catch {
    return { result: failure('bad-redirect', current.href, checkedAt) };
  }
}

async function readHop(current: URL, checkedAt: number): Promise<Hop> {
  const started = Date.now();
  let response: Response;

  try {
    response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: '*/*' },
    });
  } catch {
    return { result: failure('unreachable', current.href, checkedAt) };
  }

  const latencyMs = Date.now() - started;

  if (response.status >= 300 && response.status < 400) {
    await cancelBody(response);

    return redirectHop(response, current, checkedAt);
  }

  const result: ProbeResult = {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    latencyMs,
    contentType: response.headers.get('content-type'),
    finalUrl: current.href,
    checkedAt,
  };

  await cancelBody(response);

  return { result };
}

/**
 * GET an endpoint and keep only its response headers. The body is cancelled,
 * so a large or streaming service cannot tie up the worker. Redirects are
 * followed manually so every hop is checked by the same URL guard.
 */
export async function probeUrl(raw: string): Promise<ProbeResult> {
  const checkedAt = Date.now();
  let current: URL;

  try {
    current = new URL(raw);
  } catch {
    return failure('bad-url', raw, checkedAt);
  }

  if (current.href.length > MAX_URL_LENGTH) return failure('url-too-long', current.href, checkedAt);

  const cached = cache.get(current.href);

  if (cached && checkedAt - cached.at < CACHE_TTL_MS) return cached.result;

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (blockedUrl(current, ['http:', 'https:'])) {
      return failure('blocked-url', current.href, checkedAt);
    }

    const step = await readHop(current, checkedAt);

    if ('result' in step) {
      cache.set(current.href, { at: checkedAt, result: step.result });

      return step.result;
    }

    current = step.next;
  }

  return failure('too-many-redirects', current.href, checkedAt);
}
