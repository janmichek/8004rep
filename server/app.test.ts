import { describe, expect, test } from 'vitest';
import { agentSchema, networkSchema } from '../shared/schemas';
import { app } from './app';

describe('GET /api/agents', () => {
  test('returns the roster, parsed through the shared schema', async () => {
    const response = await app.request('/api/agents');
    const body = agentSchema.array().parse(JSON.parse(await response.text()));

    expect(response.status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body.some((agent) => agent.status === 'active')).toBe(true);
  });
});

describe('GET /api/networks', () => {
  test('returns every network, parsed through the shared schema', async () => {
    const response = await app.request('/api/networks');
    const body = networkSchema.array().parse(JSON.parse(await response.text()));

    expect(response.status).toBe(200);
    expect(body.map((network) => network.code)).toContain('BASE');
  });
});
