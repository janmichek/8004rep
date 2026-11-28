import { Hono } from 'hono';
import { REP_SPEC } from '../shared/reputation';
import { reputationSpecSchema, type AgentPage, type ReputationSpec } from '../shared/schemas';
import type { TtlCache } from './cache';
import { createAgentStore, type AgentStore } from './db/agentStore';
import { createSql, type Sql } from './db/client';
import { createNetworkStore, type NetworkStore } from './db/networkStore';
import { relayResponse as defaultRelayResponse } from './fetchJson';
import { probeUrl as defaultProbeUrl, type ProbeResult } from './probe';
import { createAgentsRoutes } from './routes/agents';
import { createNetworksRoutes } from './routes/networks';
import { createProbeRoutes } from './routes/probe';
import { createRelayRoutes, type RelayResponse } from './routes/relay';
import { createReputationRoutes } from './routes/reputation';

export type AppOptions = {
  agentStore?: AgentStore;
  networkStore?: NetworkStore;
  reputationSpec?: ReputationSpec;
  relayResponse?: RelayResponse;
  probe?: (raw: string) => Promise<ProbeResult>;
  agentCache?: TtlCache<AgentPage>;
};

function openDatabase(): Sql | null {
  const url = process.env['DATABASE_URL']?.trim();

  return url ? createSql(url) : null;
}

const UNAVAILABLE = 'DATABASE_URL is not set';

function unavailableAgents(): AgentStore {
  return {
    async listAgents() {
      throw new Error(UNAVAILABLE);
    },
    async getAgentDetail() {
      throw new Error(UNAVAILABLE);
    },
    async getAgentReputation() {
      throw new Error(UNAVAILABLE);
    },
  };
}

function unavailableNetworks(): NetworkStore {
  return {
    async listNetworks() {
      throw new Error(UNAVAILABLE);
    },
    async getNetworkStats() {
      throw new Error(UNAVAILABLE);
    },
  };
}

function defaultStores(): { agentStore: AgentStore; networkStore: NetworkStore } {
  const db = openDatabase();

  return db
    ? { agentStore: createAgentStore(db), networkStore: createNetworkStore(db) }
    : { agentStore: unavailableAgents(), networkStore: unavailableNetworks() };
}

/**
 * Builds the API with production defaults. Tests pass fakes instead of
 * stubbing the database or the network; the Bun entry adds a TTL cache.
 */
export function createApp(options: AppOptions = {}): Hono {
  const app = new Hono();
  const stores = defaultStores();
  const agentStore = options.agentStore ?? stores.agentStore;
  const networkStore = options.networkStore ?? stores.networkStore;

  app.route('/api', createAgentsRoutes(agentStore, options.agentCache));
  app.route('/api', createNetworksRoutes(networkStore));
  app.route(
    '/api',
    createReputationRoutes(options.reputationSpec ?? reputationSpecSchema.parse(REP_SPEC))
  );
  app.route('/api', createRelayRoutes(options.relayResponse ?? defaultRelayResponse));
  app.route('/api', createProbeRoutes(options.probe ?? defaultProbeUrl));

  return app;
}
