import { relayResponse } from '../server/fetchJson';

export const config = { runtime: 'edge' };

/** Vercel counterpart of the Bun server route, for production registration-file reads. */
export default async function handler(request: Request): Promise<Response> {
  return relayResponse(new URL(request.url).searchParams.get('url') ?? '');
}
