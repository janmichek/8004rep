import { Hono } from 'hono';
import { z } from 'zod';
import { agentsQuerySchema, networkSchema } from '../shared/schemas';
import { networks } from './data';
import { relayResponse } from './fetchJson';
import { fetchAgentPage } from './scanAgents';

export const app = new Hono();

// The list is served from 8004scan through this process, so the browser never
// spends the upstream rate limit and the response is checked against the contract.
app.get('/api/agents', async (c) => {
  const query = agentsQuerySchema.safeParse(c.req.query());

  if (!query.success) {
    c.header('cache-control', 'no-store');

    return c.json({ error: 'Invalid agent query' }, 400);
  }

  try {
    const page = await fetchAgentPage(query.data);

    c.header('cache-control', 'public, s-maxage=30, max-age=10');

    return c.json(page);
  } catch {
    c.header('cache-control', 'no-store');

    return c.json({ error: '8004scan could not be reached' }, 502);
  }
});

app.get('/api/networks', (c) => c.json(z.array(networkSchema).parse(networks)));

app.get('/api/fetch-json', async (c) => relayResponse(c.req.query('url') ?? ''));
