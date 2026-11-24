import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { agentSchema, networkSchema } from '../shared/schemas';

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

const document = {
  openapi: '3.1.0',
  info: { title: '8004rep', version: '0.1.0' },
  paths: {
    '/api/agents': {
      get: {
        operationId: 'listAgents',
        responses: { 200: ok('Agents', z.array(agentSchema)) },
      },
    },
    '/api/networks': {
      get: {
        operationId: 'listNetworks',
        responses: { 200: ok('Networks', z.array(networkSchema)) },
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
