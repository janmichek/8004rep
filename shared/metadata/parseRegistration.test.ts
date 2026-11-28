import { gzipSync, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  decodeDataUri,
  parseRegistration,
  parseRegistrationText,
  registrationSchema,
} from './parseRegistration';

const JSON_BODY = JSON.stringify({
  name: 'Atlas',
  description: 'A broker',
  image: 'ipfs://cid/logo.png',
  active: true,
  x402Support: true,
  version: '1.2.3',
  services: [
    { name: 'MCP', endpoint: 'https://mcp.example', version: '1.0.0' },
    { type: 'A2A', value: 'https://a2a.example', meta: { version: '2.0.0' } },
    { name: '', endpoint: 'https://ignored.example' },
  ],
  supportedTrust: ['reputation', ' '],
});

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

describe('parseRegistration', () => {
  it('normalizes current and legacy fields', () => {
    const parsed = parseRegistration(registrationSchema.parse(JSON.parse(JSON_BODY)));

    expect(parsed.name).toBe('Atlas');
    expect(parsed.active).toBe(true);
    expect(parsed.x402).toBe(true);
    expect(parsed.services).toEqual([
      { name: 'MCP', endpoint: 'https://mcp.example', version: '1.0.0' },
      { name: 'A2A', endpoint: 'https://a2a.example', version: '2.0.0' },
    ]);
    expect(parsed.supportedTrust).toEqual(['reputation']);
  });

  it('keeps optional fields absent when the file omits them', () => {
    const parsed = parseRegistration({});
    expect(parsed.name).toBeUndefined();
    expect(parsed.active).toBeUndefined();
    expect(parsed.x402).toBe(false);
    expect(parsed.services).toEqual([]);
  });

  it('accepts legacy endpoints and trustModels', () => {
    const parsed = parseRegistration({
      endpoints: [{ name: 'HTTP', endpoint: 'https://legacy.example' }],
      trustModels: ['tee'],
      x402support: true,
    });

    expect(parsed.services[0]?.name).toBe('HTTP');
    expect(parsed.supportedTrust).toEqual(['tee']);
    expect(parsed.x402).toBe(true);
  });

  it('rejects a JSON body that is not a registration file', () => {
    expect(parseRegistrationText('[]')).toBeNull();
    expect(() => parseRegistrationText('not json')).toThrow();
  });
});

describe('decodeDataUri', () => {
  it('decodes base64 JSON', async () => {
    const uri = `data:application/json;base64,${base64(new TextEncoder().encode(JSON_BODY))}`;
    await expect(decodeDataUri(uri)).resolves.toMatchObject({ name: 'Atlas' });
  });

  it('decodes percent-encoded JSON', async () => {
    const uri = `data:application/json,${encodeURIComponent(JSON_BODY)}`;
    await expect(decodeDataUri(uri)).resolves.toMatchObject({ name: 'Atlas' });
  });

  it('inflates gzip declared in the media type', async () => {
    const uri = `data:application/json;enc=gzip;base64,${base64(gzipSync(JSON_BODY))}`;
    await expect(decodeDataUri(uri)).resolves.toMatchObject({ name: 'Atlas' });
  });

  it('sniffs gzip and deflate without a declared coding', async () => {
    const gzip = `data:application/json;base64,${base64(gzipSync(JSON_BODY))}`;
    const deflate = `data:application/json;base64,${base64(deflateSync(JSON_BODY))}`;
    await expect(decodeDataUri(gzip)).resolves.toMatchObject({ name: 'Atlas' });
    await expect(decodeDataUri(deflate)).resolves.toMatchObject({ name: 'Atlas' });
  });

  it('rejects other media types and malformed URIs', async () => {
    await expect(decodeDataUri('data:text/plain,hello')).resolves.toBeNull();
    await expect(decodeDataUri('https://example.com/a.json')).resolves.toBeNull();
  });
});
