import { z } from 'zod';

const serviceSchema = z
  .object({
    name: z.string().optional(),
    type: z.string().optional(),
    endpoint: z.string().optional(),
    value: z.string().optional(),
    version: z.string().optional(),
    meta: z.object({ version: z.string().optional() }).loose().optional(),
  })
  .loose();

/**
 * The registration file as served. Legacy `endpoints`/`trustModels` keys and
 * unknown fields are accepted; only the values the explorer shows are read.
 */
export const registrationSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    active: z.boolean().optional(),
    x402Support: z.boolean().optional(),
    x402support: z.boolean().optional(),
    version: z.string().optional(),
    services: z.array(serviceSchema).optional(),
    endpoints: z.array(serviceSchema).optional(),
    supportedTrust: z.array(z.string()).optional(),
    trustModels: z.array(z.string()).optional(),
  })
  .loose();

export type RegistrationJson = z.infer<typeof registrationSchema>;

export type RegistrationService = { name: string; endpoint: string; version?: string };

export type ParsedRegistration = {
  name?: string;
  description?: string;
  image?: string;
  active?: boolean;
  x402: boolean;
  version?: string;
  services: RegistrationService[];
  supportedTrust: string[];
  raw: RegistrationJson;
};

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}

function toService(value: z.infer<typeof serviceSchema>): RegistrationService | null {
  const name = nonEmpty(value.name) ?? nonEmpty(value.type);
  const endpoint = nonEmpty(value.endpoint) ?? nonEmpty(value.value);

  if (!name || !endpoint) return null;
  const version = nonEmpty(value.version) ?? nonEmpty(value.meta?.version);

  return version ? { name, endpoint, version } : { name, endpoint };
}

function applyOptional(parsed: ParsedRegistration, json: RegistrationJson): void {
  const name = nonEmpty(json.name);
  const description = nonEmpty(json.description);
  const image = nonEmpty(json.image);
  const version = nonEmpty(json.version);

  if (name) parsed.name = name;

  if (description) parsed.description = description;

  if (image) parsed.image = image;

  if (version) parsed.version = version;

  if (json.active !== undefined) parsed.active = json.active;
}

/** Maps the served JSON onto the fields the indexer stores. */
export function parseRegistration(json: RegistrationJson): ParsedRegistration {
  const services = json.services ?? json.endpoints ?? [];
  const trust = json.supportedTrust ?? json.trustModels ?? [];

  const parsed: ParsedRegistration = {
    x402: json.x402Support ?? json.x402support ?? false,
    services: services.flatMap((service) => toService(service) ?? []),
    supportedTrust: trust.flatMap((entry) => (nonEmpty(entry) ? [entry] : [])),
    raw: json,
  };

  applyOptional(parsed, json);

  return parsed;
}

export function parseRegistrationText(text: string): ParsedRegistration | null {
  const parsed = registrationSchema.safeParse(JSON.parse(text));

  return parsed.success ? parseRegistration(parsed.data) : null;
}

type Coding = 'gzip' | 'deflate';

function declaredCoding(params: string): Coding | undefined {
  const value = /;\s*(?:enc=)?(gzip|deflate)\b/i.exec(params)?.[1]?.toLowerCase();

  if (value === 'gzip' || value === 'deflate') return value;

  return undefined;
}

function sniffCoding(bytes: Uint8Array): Coding | undefined {
  const first = bytes[0] ?? 0;
  const second = bytes[1] ?? 0;

  if (first === 0x1f && second === 0x8b) return 'gzip';

  if (first === 0x78 && ((first << 8) | second) % 31 === 0) return 'deflate';

  return undefined;
}

const MAX_PAYLOAD_CHARS = 1_000_000;
const MAX_INFLATED_BYTES = 5_000_000;

function cappedStream(): TransformStream<Uint8Array, Uint8Array> {
  let total = 0;

  return new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength;

      if (total > MAX_INFLATED_BYTES) controller.error(new Error('metadata too large'));
      else controller.enqueue(chunk);
    },
  });
}

async function inflate(bytes: Uint8Array, coding: Coding): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream(coding))
    .pipeThrough(cappedStream());

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decodes `data:` registration URIs: base64 or percent-encoded payloads,
 * optionally gzip/deflate compressed (`;enc=gzip` or gzip magic).
 */
function isAllowedData(params: string, payload: string): boolean {
  if (payload.length > MAX_PAYLOAD_CHARS) return false;
  const mediaType = (params.split(';')[0] ?? '').trim().toLowerCase();

  return !mediaType || mediaType === 'application/json';
}

export async function decodeDataUri(uri: string): Promise<ParsedRegistration | null> {
  const match = /^data:([^,]*),(.*)$/is.exec(uri);

  if (!match) return null;

  const params = match[1] ?? '';
  const payload = match[2] ?? '';

  if (!isAllowedData(params, payload)) return null;

  const bytes = /;base64/i.test(params)
    ? Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));

  const coding = declaredCoding(params) ?? sniffCoding(bytes);
  const text = new TextDecoder().decode(coding ? await inflate(bytes, coding) : bytes);

  return parseRegistrationText(text);
}
