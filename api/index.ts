import { getRequestListener } from '@hono/node-server';
import { createApp } from '../server/app';

// Preview and production deployments run the API as a Vercel Node.js Function.
// postgres.js needs a Node runtime to reach DATABASE_URL; the CDN owns HTTP caching.
export const config = { runtime: 'nodejs' };

export default getRequestListener(createApp().fetch);
