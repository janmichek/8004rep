import { handle } from 'hono/vercel';
import { createApp } from '../server/app';

// Preview and production deployments run the API as a Vercel Function.
// The CDN owns HTTP caching, so the edge instance has no in-process cache.
export const config = { runtime: 'edge' };

export default handle(createApp());
