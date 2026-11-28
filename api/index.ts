import { handle } from 'hono/vercel';
import { createApp } from '../server/app';

// Preview and production deployments run the API as a Vercel Node.js Function.
// postgres.js needs a Node runtime to reach DATABASE_URL; the CDN owns HTTP caching.
export const config = { runtime: 'nodejs22.x' };

export default handle(createApp());
