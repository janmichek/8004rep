import { Hono, type Context } from 'hono';
import { agentsQuerySchema, type AgentPage, type AgentsQuery } from '../../shared/schemas';
import type { AgentStore } from '../db/agentStore';
import type { TtlCache } from '../cache';

const CACHE_CONTROL = 'public, s-maxage=60, max-age=10, stale-while-revalidate=300';
const NO_STORE = 'no-store';

/** Zod emits keys in schema order, so the same query always builds the same key. */
function queryKey(query: AgentsQuery): string {
  return JSON.stringify(query);
}

function chainIdOf(raw: string | undefined): number | null {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : null;
}

function tokenIdOf(raw: string | undefined): string | null {
  return raw !== undefined && /^\d+$/.test(raw) ? raw : null;
}

type AgentReader<T> = (chainId: number, tokenId: string) => Promise<T | null>;

/** Shared id parsing, cache headers and failure mapping for the two agent reads. */
async function agentResponse<T extends object>(
  c: Context,
  read: AgentReader<T>,
  notFound: string
): Promise<Response> {
  const chainId = chainIdOf(c.req.param('chainId'));
  const tokenId = tokenIdOf(c.req.param('tokenId'));

  if (chainId === null || tokenId === null) {
    c.header('cache-control', NO_STORE);

    return c.json({ error: 'Invalid agent id' }, 400);
  }

  try {
    const value = await read(chainId, tokenId);

    if (value === null) {
      c.header('cache-control', NO_STORE);

      return c.json({ error: notFound }, 404);
    }

    c.header('cache-control', CACHE_CONTROL);

    return c.json(value);
  } catch {
    c.header('cache-control', NO_STORE);

    return c.json({ error: 'Agents are unavailable' }, 503);
  }
}

export function createAgentsRoutes(store: AgentStore, cache?: TtlCache<AgentPage>): Hono {
  const routes = new Hono();

  routes.get('/agents', async (c) => {
    const query = agentsQuerySchema.safeParse(c.req.query());

    if (!query.success) {
      c.header('cache-control', NO_STORE);

      return c.json({ error: 'Invalid agent query' }, 400);
    }

    const key = queryKey(query.data);
    const cached = cache?.get(key);

    if (cached !== undefined) {
      c.header('cache-control', CACHE_CONTROL);

      return c.json(cached);
    }

    try {
      const page = await store.listAgents(query.data);

      cache?.set(key, page);
      c.header('cache-control', CACHE_CONTROL);

      return c.json(page);
    } catch {
      c.header('cache-control', NO_STORE);

      return c.json({ error: 'Agents are unavailable' }, 503);
    }
  });

  routes.get('/agents/:chainId/:tokenId', (c) =>
    agentResponse(
      c,
      (chainId, tokenId) => store.getAgentDetail(chainId, tokenId),
      'Agent not indexed'
    )
  );

  routes.get('/agents/:chainId/:tokenId/reputation', (c) =>
    agentResponse(
      c,
      (chainId, tokenId) => store.getAgentReputation(chainId, tokenId),
      'Agent not indexed'
    )
  );

  return routes;
}
