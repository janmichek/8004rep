import { Hono } from 'hono';
import { z } from 'zod';
import { agentSchema, networkSchema } from '../shared/schemas';
import { agents, networks } from './data';

export const app = new Hono();

// Fixtures are parsed through the shared schemas before leaving the server
app.get('/api/agents', (c) => c.json(z.array(agentSchema).parse(agents)));

app.get('/api/networks', (c) => c.json(z.array(networkSchema).parse(networks)));
