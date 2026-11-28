import { Hono } from 'hono';
import type { ProbeResult } from '../probe';

export type ProbeHandler = (raw: string) => Promise<ProbeResult>;

/** 400 only for a request that cannot be attempted; upstream outcomes are 200 with `ok: false`. */
export function statusOf(result: ProbeResult): 200 | 400 {
  return result.error === 'bad-url' ||
    result.error === 'url-too-long' ||
    result.error === 'blocked-url'
    ? 400
    : 200;
}

export function createProbeRoutes(probe: ProbeHandler): Hono {
  const routes = new Hono();

  routes.get('/probe', async (c) => {
    const result = await probe(c.req.query('url') ?? '');

    return c.json(result, statusOf(result));
  });

  return routes;
}
