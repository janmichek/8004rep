/**
 * Deterministic JSON: object keys sorted at every level, no whitespace. Two
 * runs over the same inputs produce the same bytes, which is what makes the
 * downloadable evidence hash meaningful.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = canonicalValue(source[key]);
    return out;
  }
  return value;
}

/** Lower-case SHA-256 hex of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The hash block written into the downloaded inputs file. */
export type ContentHash = {
  algorithm: 'sha256';
  value: string;
  /** What a verifier must hash to reproduce `value`. */
  covers: 'canonical JSON of this object with contentHash removed';
};

export async function hashEvidence(inputs: unknown): Promise<ContentHash> {
  return {
    algorithm: 'sha256',
    value: await sha256Hex(canonicalJson(inputs)),
    covers: 'canonical JSON of this object with contentHash removed',
  };
}
