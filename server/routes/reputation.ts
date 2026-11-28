import { Hono } from 'hono';
import { reputationSpecSchema, type ReputationSpec } from '../../shared/schemas';

const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800';

/** The published formula is immutable per version, so it gets a long cache. */
export function createReputationRoutes(spec: ReputationSpec): Hono {
  const routes = new Hono();
  const body = reputationSpecSchema.parse(spec);

  routes.get('/reputation/spec', (c) => {
    c.header('cache-control', CACHE_CONTROL);

    return c.json(body);
  });

  return routes;
}
