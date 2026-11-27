import { Hono } from 'hono';

export type RelayResponse = (raw: string) => Promise<Response>;

export function createRelayRoutes(relayResponse: RelayResponse): Hono {
  const routes = new Hono();

  routes.get('/fetch-json', async (c) => relayResponse(c.req.query('url') ?? ''));

  return routes;
}
