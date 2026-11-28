import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  agentDetailResponseSchema,
  agentPageSchema,
  agentQueryFields,
  agentReputationResponseSchema,
  networkSchema,
  networkStatsSchema,
  reputationSpecSchema,
} from '../shared/schemas';

const root = fileURLToPath(new URL('..', import.meta.url));

function responseSchema(schema: z.ZodType) {
  const generated = z.toJSONSchema(schema);
  delete generated['$schema'];

  return generated;
}

function ok(description: string, schema: z.ZodType) {
  return {
    description,
    content: { 'application/json': { schema: responseSchema(schema) } },
  };
}

/** Turns the list query's Zod fields into OpenAPI parameters; the contract stays one file. */
function queryParameters() {
  return Object.entries(agentQueryFields).map(([name, schema]) => ({
    name,
    in: 'query',
    required: false,
    schema: responseSchema(schema),
  }));
}

function path(name: string) {
  return { name, in: 'path', required: true, schema: { type: 'string' } };
}

const document = {
  openapi: '3.1.0',
  info: { title: '8004rep', version: '0.1.0' },
  paths: {
    '/api/agents': {
      get: {
        operationId: 'listAgents',
        parameters: queryParameters(),
        responses: { 200: ok('Agents', agentPageSchema) },
      },
    },
    '/api/agents/{chainId}/{tokenId}': {
      get: {
        operationId: 'getAgent',
        parameters: [path('chainId'), path('tokenId')],
        responses: { 200: ok('Indexed agent', agentDetailResponseSchema) },
      },
    },
    '/api/agents/{chainId}/{tokenId}/reputation': {
      get: {
        operationId: 'getAgentReputation',
        parameters: [path('chainId'), path('tokenId')],
        responses: { 200: ok('rep-1.0 report', agentReputationResponseSchema) },
      },
    },
    '/api/networks': {
      get: {
        operationId: 'listNetworks',
        responses: { 200: ok('Networks', z.array(networkSchema)) },
      },
    },
    '/api/networks/{chainId}/stats': {
      get: {
        operationId: 'getNetworkStats',
        parameters: [path('chainId')],
        responses: { 200: ok('Network totals', networkStatsSchema) },
      },
    },
    '/api/reputation/spec': {
      get: {
        operationId: 'getReputationSpec',
        responses: { 200: ok('Published rep-1.0 specification', reputationSpecSchema) },
      },
    },
  },
};

const openapiPath = fileURLToPath(new URL('../shared/openapi.json', import.meta.url));
const schemaPath = fileURLToPath(new URL('../src/shared/api/schema.d.ts', import.meta.url));

writeFileSync(openapiPath, `${JSON.stringify(document, null, 2)}\n`);

execFileSync(
  fileURLToPath(new URL('../node_modules/.bin/openapi-typescript', import.meta.url)),
  [openapiPath, '-o', schemaPath],
  {
    cwd: root,
    stdio: 'inherit',
  }
);
