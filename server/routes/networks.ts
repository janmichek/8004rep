import { Hono } from 'hono';
import { networkSchema, type Network } from '../../shared/schemas';

const CACHE_CONTROL = 'public, s-maxage=86400, max-age=3600, stale-while-revalidate=604800';

/** Parse once at startup: a bad network record should fail the server, not a request. */
export function createNetworksRoutes(networks: readonly Network[]): Hono {
  const body = networkSchema.array().parse(networks);
  const routes = new Hono();

  routes.get('/networks', (c) => {
    c.header('cache-control', CACHE_CONTROL);

    return c.json(body);
  });

  return routes;
}
