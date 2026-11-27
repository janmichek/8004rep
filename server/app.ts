import { Hono } from 'hono';
import type { AgentPage, Network } from '../shared/schemas';
import type { TtlCache } from './cache';
import { networks as defaultNetworks } from './data';
import { relayResponse as defaultRelayResponse } from './fetchJson';
import { createAgentsRoutes, type AgentPageFetcher } from './routes/agents';
import { createNetworksRoutes } from './routes/networks';
import { createRelayRoutes, type RelayResponse } from './routes/relay';
import { fetchAgentPage as defaultFetchAgentPage } from './scanAgents';

export type AppOptions = {
  fetchAgentPage?: AgentPageFetcher;
  networks?: readonly Network[];
  relayResponse?: RelayResponse;
  agentCache?: TtlCache<AgentPage>;
};

/**
 * Builds the API with production defaults. Tests pass fakes instead of stubbing
 * the network, and the Bun entry adds a cache the edge function deliberately omits.
 */
export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();

  app.route(
    '/api',
    createAgentsRoutes(options.fetchAgentPage ?? defaultFetchAgentPage, options.agentCache)
  );

  app.route('/api', createNetworksRoutes(options.networks ?? defaultNetworks));

  app.route('/api', createRelayRoutes(options.relayResponse ?? defaultRelayResponse));

  return app;
}
