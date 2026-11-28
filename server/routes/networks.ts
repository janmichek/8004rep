import { Hono } from 'hono';
import type { NetworkStore } from '../db/networkStore';

const CACHE_CONTROL = 'public, s-maxage=60, max-age=10, stale-while-revalidate=300';
const NO_STORE = 'no-store';

function chainIdOf(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export function createNetworksRoutes(store: NetworkStore): Hono {
  const routes = new Hono();

  routes.get('/networks', async (c) => {
    try {
      const networks = await store.listNetworks();
      c.header('cache-control', CACHE_CONTROL);

      return c.json(networks);
    } catch {
      c.header('cache-control', NO_STORE);

      return c.json({ error: 'Networks are unavailable' }, 503);
    }
  });

  routes.get('/networks/:chainId/stats', async (c) => {
    const chainId = chainIdOf(c.req.param('chainId'));

    if (chainId === null) {
      c.header('cache-control', NO_STORE);

      return c.json({ error: 'Invalid chain id' }, 400);
    }

    try {
      const stats = await store.getNetworkStats(chainId);

      if (!stats) {
        c.header('cache-control', NO_STORE);

        return c.json({ error: 'Unknown network' }, 404);
      }

      c.header('cache-control', CACHE_CONTROL);

      return c.json(stats);
    } catch {
      c.header('cache-control', NO_STORE);

      return c.json({ error: 'Networks are unavailable' }, 503);
    }
  });

  return routes;
}
