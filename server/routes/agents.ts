import { Hono } from 'hono';
import { agentsQuerySchema, type AgentPage, type AgentsQuery } from '../../shared/schemas';
import type { TtlCache } from '../cache';
import { ScanUpstreamError } from '../scanAgents';

/** A page fetcher the app can replace in tests; `fetchAgentPage` is the production one. */
export type AgentPageFetcher = (query: AgentsQuery) => Promise<AgentPage>;

const CACHE_CONTROL = 'public, s-maxage=60, max-age=10, stale-while-revalidate=300';

/** Zod emits keys in schema order, so the same query always builds the same key. */
function queryKey(query: AgentsQuery): string {
  return JSON.stringify(query);
}

export function createAgentsRoutes(
  fetchAgentPage: AgentPageFetcher,
  cache?: TtlCache<AgentPage>
): Hono {
  const routes = new Hono();

  routes.get('/agents', async (c) => {
    const query = agentsQuerySchema.safeParse(c.req.query());

    if (!query.success) {
      c.header('cache-control', 'no-store');

      return c.json({ error: 'Invalid agent query' }, 400);
    }

    const key = queryKey(query.data);
    const cached = cache?.get(key);

    if (cached !== undefined) {
      c.header('cache-control', CACHE_CONTROL);

      return c.json(cached);
    }

    try {
      const page = await fetchAgentPage(query.data);

      cache?.set(key, page);
      c.header('cache-control', CACHE_CONTROL);

      return c.json(page);
    } catch (error) {
      c.header('cache-control', 'no-store');

      if (error instanceof ScanUpstreamError && error.status === 429) {
        if (error.retryAfter !== undefined) c.header('retry-after', error.retryAfter);

        return c.json({ error: '8004scan rate limit reached' }, 429);
      }

      return c.json({ error: '8004scan could not be reached' }, 502);
    }
  });

  return routes;
}
