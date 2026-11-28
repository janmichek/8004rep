import {
  buildReputationReport,
  inferTagScales,
  type FeedbackInput,
  type FeedbackResponseInput,
  type TagScale,
} from '../../shared/reputation';

export type {
  ScorableAgent,
  ScoreFeedbackRow,
  ScorerOptions,
  ScorerResult,
  ScorerStore,
} from './scorerTypes';

import type {
  DrainOptions,
  ScorableAgent,
  ScoreFeedbackRow,
  ScorerOptions,
  ScorerResult,
  ScorerStore,
  SelfAddresses,
} from './scorerTypes';

function toInput(row: ScoreFeedbackRow): FeedbackInput {
  const responses: FeedbackResponseInput[] = row.responses.map((response) => {
    const input: FeedbackResponseInput = { responder: response.responder };

    if (response.uri) input.uri = response.uri;

    if (response.createdAt !== null) input.createdAt = response.createdAt;

    if (response.txHash) input.txHash = response.txHash;

    return input;
  });

  const input: FeedbackInput = {
    client: row.client,
    value: row.value,
    revoked: row.revoked,
    responses,
  };

  if (row.tag1) input.tag1 = row.tag1;

  if (row.tag2) input.tag2 = row.tag2;

  if (row.endpoint) input.endpoint = row.endpoint;

  if (row.feedbackUri) input.feedbackURI = row.feedbackUri;

  if (row.createdAt !== null) input.createdAt = row.createdAt;

  if (row.txHash) input.txHash = row.txHash;

  return input;
}

function selfList(agent: SelfAddresses): string[] {
  return [agent.owner, agent.agentWallet].flatMap((address) => (address ? [address] : []));
}

function isSelf(row: ScoreFeedbackRow & SelfAddresses): boolean {
  const client = row.client.toLowerCase();

  return selfList(row).some((address) => address.toLowerCase() === client);
}

type ScaleInput = { client: string; value: number; tag1?: string; revoked: boolean };

function scaleInput(row: ScoreFeedbackRow & SelfAddresses): ScaleInput | null {
  if (row.revoked || isSelf(row)) return null;

  const input: ScaleInput = { client: row.client, value: row.value, revoked: false };

  if (row.tag1) input.tag1 = row.tag1;

  return input;
}

async function rebuildScales(
  store: ScorerStore,
  chainId: number
): Promise<ReadonlyMap<string, TagScale>> {
  const rows = await store.chainFeedback(chainId);

  const scoreable = rows.flatMap((row) => {
    const input = scaleInput(row);

    return input ? [input] : [];
  });

  const scales = inferTagScales(scoreable);

  await store.saveTagScales(chainId, scales);

  return scales;
}

async function scoreAgent(
  store: ScorerStore,
  agent: ScorableAgent,
  scales: ReadonlyMap<string, TagScale>,
  now: number
): Promise<void> {
  const rows = await store.feedbackForAgent(agent.chainId, agent.tokenId);

  const report = buildReputationReport(rows.map(toInput), {
    self: selfList(agent),
    scales,
    now,
  });

  await store.saveScore(agent.chainId, agent.tokenId, report, now);
  await store.clearDirty(agent.chainId, agent.tokenId);
}

async function drainDirty(options: DrainOptions): Promise<number> {
  const { store, chainId, scales, batchSize, now } = options;
  let scored = 0;

  for (;;) {
    const agents = await store.dirtyAgents(chainId, batchSize);

    for (const agent of agents) {
      try {
        await scoreAgent(store, agent, scales, now);
        scored++;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'scoring failed';
        options.log?.(`score failed ${agent.chainId}:${agent.tokenId}: ${message}`);

        return scored;
      }
    }

    if (agents.length < batchSize) return scored;
  }
}

type StaleDrain = {
  store: ScorerStore;
  scalesByChain: Map<number, ReadonlyMap<string, TagScale>>;
  batchSize: number;
  now: number;
  log?: ((message: string) => void) | undefined;
};

async function scoreStaleBatch(
  batch: readonly ScorableAgent[],
  args: StaleDrain
): Promise<boolean> {
  for (const agent of batch) {
    let scales = args.scalesByChain.get(agent.chainId);

    if (!scales) {
      scales = await rebuildScales(args.store, agent.chainId);
      args.scalesByChain.set(agent.chainId, scales);
    }

    try {
      await scoreAgent(args.store, agent, scales, args.now);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'scoring failed';
      args.log?.(`stale score failed ${agent.chainId}:${agent.tokenId}: ${message}`);

      return true;
    }
  }

  return false;
}

async function drainStale(args: StaleDrain): Promise<number> {
  let stale = 0;

  for (;;) {
    const batch = await args.store.staleAgents(args.batchSize);

    if (batch.length === 0) return stale;

    const failed = await scoreStaleBatch(batch, args);

    if (!failed) stale += batch.length;

    if (failed || batch.length < args.batchSize) return stale;
  }
}

/**
 * Materializes `rep-1.0`. Dirty chains get fresh chain-wide tag scales first,
 * then each dirty agent is scored in batches; the daily sweep recalculates
 * decay for agents with no new events.
 */
export async function runScorer(options: ScorerOptions): Promise<ScorerResult> {
  const { store, now } = options;
  const batchSize = options.batchSize ?? 50;
  const dirtyChains = await store.chainsWithDirtyAgents();
  const scalesByChain = new Map<number, ReadonlyMap<string, TagScale>>();
  let agents = 0;
  let tags = 0;

  for (const chainId of dirtyChains) {
    const scales = await rebuildScales(store, chainId);
    scalesByChain.set(chainId, scales);
    tags += scales.size;
    agents += await drainDirty({ store, chainId, scales, batchSize, now, log: options.log });
  }

  const stale = await drainStale({ store, scalesByChain, batchSize, now, log: options.log });

  return { chains: dirtyChains.length, agents, stale, tags };
}
