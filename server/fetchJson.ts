import { blockedUrl } from './urlGuard';

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 256 * 1024;
const MAX_HOPS = 5;

type RelayResult = { status: number; body: string; type: string };

type Step = { result: RelayResult } | { next: URL };

async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? 0);

  if (declared > MAX_BYTES) return null;

  const body = await response.arrayBuffer();

  return body.byteLength > MAX_BYTES ? null : new TextDecoder().decode(body);
}

function redirectTarget(response: Response, current: URL): URL | null {
  const location = response.headers.get('location');

  if (!location) return null;

  try {
    return new URL(location, current);
  } catch {
    return null;
  }
}

function jsonFailure(text: string | null): RelayResult | null {
  if (text === null) return { status: 413, body: 'Too large', type: 'text/plain' };

  try {
    JSON.parse(text);
  } catch {
    return { status: 502, body: 'Upstream did not return JSON', type: 'text/plain' };
  }

  return null;
}

async function fetchStep(current: URL): Promise<Step> {
  let response: Response;

  try {
    response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { result: { status: 502, body: 'Upstream unreachable', type: 'text/plain' } };
  }

  if (response.status >= 300 && response.status < 400) {
    const next = redirectTarget(response, current);

    return next ? { next } : { result: { status: 502, body: 'Bad redirect', type: 'text/plain' } };
  }

  if (response.status < 200 || response.status >= 300) {
    return {
      result: { status: 502, body: `Upstream HTTP ${response.status}`, type: 'text/plain' },
    };
  }

  const text = await readCapped(response);
  const failure = jsonFailure(text);

  if (failure) return { result: failure };

  return { result: { status: 200, body: text ?? '', type: 'application/json' } };
}

/** Relays JSON from a public https URL, for files served without CORS headers. */
export async function relayJson(raw: string): Promise<RelayResult> {
  let current: URL;

  try {
    current = new URL(raw);
  } catch {
    return { status: 400, body: 'Bad url', type: 'text/plain' };
  }

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (blockedUrl(current)) return { status: 400, body: 'Blocked url', type: 'text/plain' };

    const step = await fetchStep(current);

    if ('result' in step) return step.result;

    current = step.next;
  }

  return { status: 502, body: 'Too many redirects', type: 'text/plain' };
}

export async function relayResponse(raw: string): Promise<Response> {
  const relayed = await relayJson(raw);

  return new Response(relayed.body, {
    status: relayed.status,
    headers: {
      'content-type': relayed.type,
      'cache-control': relayed.status === 200 ? 'public, s-maxage=3600, max-age=300' : 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
