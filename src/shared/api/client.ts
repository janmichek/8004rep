import createClient from 'openapi-fetch';
import { z } from 'zod';
import { agentSchema, networkSchema } from '@shared/schemas';
import type { paths } from './schema';

// Paths come from the generated OpenAPI types. Response bodies are still parsed
// with the shared Zod schemas, so a payload that doesn't match the contract throws.
// fetch is read at call time so Vitest's stubGlobal replaces it after import.
const client = createClient<paths>({
  baseUrl: '',
  fetch: (input: Request) => globalThis.fetch(input),
});

function requestFailed(response: Response): Error {
  return new Error(`Request failed: ${response.status}`);
}

export async function fetchAgents() {
  const { data, response } = await client.GET('/api/agents');

  if (!response.ok) throw requestFailed(response);

  return z.array(agentSchema).parse(data);
}

export async function fetchNetworks() {
  const { data, response } = await client.GET('/api/networks');

  if (!response.ok) throw requestFailed(response);

  return z.array(networkSchema).parse(data);
}
