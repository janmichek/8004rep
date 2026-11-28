import { z } from 'zod';

/** The canonical JSON data model: what a verifier can re-hash without ambiguity. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const JSON_OBJECT = z.record(z.string(), z.json());

/**
 * Deterministic JSON: object keys sorted at every level, no whitespace. Two
 * runs over the same inputs produce the same bytes, which is what makes the
 * downloadable evidence hash meaningful.
 */
export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalValue);
  const parsed = JSON_OBJECT.safeParse(value);

  if (!parsed.success) return value;
  const out: { [key: string]: JsonValue } = {};

  for (const key of Object.keys(parsed.data).toSorted()) {
    const next = parsed.data[key];

    if (next !== undefined) out[key] = canonicalValue(next);
  }

  return out;
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

export async function hashEvidence(inputs: JsonValue): Promise<ContentHash> {
  return {
    algorithm: 'sha256',
    value: await sha256Hex(canonicalJson(inputs)),
    covers: 'canonical JSON of this object with contentHash removed',
  };
}
