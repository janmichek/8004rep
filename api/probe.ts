import { probeUrl } from '../server/probe';
import { statusOf } from '../server/routes/probe';

export const config = { runtime: 'edge' };

/** Vercel counterpart of the Bun probe route, for liveness checks in production. */
export default async function handler(request: Request): Promise<Response> {
  const result = await probeUrl(new URL(request.url).searchParams.get('url') ?? '');

  return Response.json(result, { status: statusOf(result) });
}
