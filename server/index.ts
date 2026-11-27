import { serveStatic } from 'hono/bun';
import type { AgentPage } from '../shared/schemas';
import { createApp } from './app';
import { createTtlCache } from './cache';

const AGENT_CACHE_TTL_MS = 15_000;
const AGENT_CACHE_MAX_ENTRIES = 200;

const app = createApp({
  agentCache: createTtlCache<AgentPage>(AGENT_CACHE_TTL_MS, AGENT_CACHE_MAX_ENTRIES, Date.now),
});

// Serve the production React build from this same server so
// one Docker container handles both API and UI on :3001.
app.use('*', serveStatic({ root: './build' }));

app.get('*', serveStatic({ path: './build/index.html' }));

// Keep the connection open past the upstream's 10s abort so a slow 8004scan
// becomes the proxy's 502 instead of a dropped socket.
export default { port: 3001, idleTimeout: 30, fetch: app.fetch };
