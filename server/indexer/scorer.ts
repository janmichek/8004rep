import {
  buildReputationReport,
  inferTagScales,
  type FeedbackInput,
  type FeedbackResponseInput,
  type ReputationReport,
  type TagScale,
} from '../../shared/reputation';

export type ScoreFeedbackRow = {
  chainId: number;
  tokenId: string;
  client: string;
  feedbackIndex: string;
  endpoint: string | null;
  feedbackUri: string | null;
  value: number;
  tag1: string | null;
  tag2: string | null;
  revoked: boolean;
  createdAt: number | null;
  txHash: string | null;
  responses: readonly {
    responder: string;
    uri: string | null;
    createdAt: number | null;
    txHash: string | null;
  }[];
};

/** The owner/agent-wallet pair whose rows never enter a score. */
export type SelfAddresses = { owner: string | null; agentWallet: string | null };

export type ScorableAgent = SelfAddresses & { chainId: number; tokenId: string };

export type ScorerStore = {
  chainsWithDirtyAgents(): Promise<number[]>;
  /** All feedback on a chain, joined with each agent's self addresses. */
  chainFeedback(chainId: number): Promise<(ScoreFeedbackRow & SelfAddresses)[]>;
  dirtyAgents(chainId: number, limit: number): Promise<ScorableAgent[]>;
  feedbackForAgent(chainId: number, tokenId: string): Promise<ScoreFeedbackRow[]>;
  saveTagScales(chainId: number, scales: ReadonlyMap<string, TagScale>): Promise<void>;
  saveScore(
    chainId: number,
    tokenId: string,
    report: ReputationReport,
    scoredAt: number
  ): Promise<void>;
  clearDirty(chainId: number, tokenId: string): Promise<void>;
  /** Agents whose last score is older than a day and that have feedback. */
  staleAgents(limit: number): Promise<ScorableAgent[]>;
};

export type ScorerOptions = {
  store: ScorerStore;
  /** Unix seconds. */
  now: number;
  batchSize?: number;
};

export type ScorerResult = {
  chains: number;
  agents: number;
  stale: number;
  tags: number;
};

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

type DrainOptions = {
  store: ScorerStore;
  chainId: number;
  scales: ReadonlyMap<string, TagScale>;
  batchSize: number;
  now: number;
};

async function drainDirty(options: DrainOptions): Promise<number> {
  const { store, chainId, scales, batchSize, now } = options;
  let scored = 0;

  for (;;) {
    const agents = await store.dirtyAgents(chainId, batchSize);

    for (const agent of agents) await scoreAgent(store, agent, scales, now);
    scored += agents.length;

    if (agents.length < batchSize) return scored;
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
    agents += await drainDirty({ store, chainId, scales, batchSize, now });
  }

  let stale = 0;

  for (;;) {
    const batch = await store.staleAgents(batchSize);

    if (batch.length === 0) break;

    for (const agent of batch) {
      let scales = scalesByChain.get(agent.chainId);

      if (!scales) {
        scales = await rebuildScales(store, agent.chainId);
        scalesByChain.set(agent.chainId, scales);
      }

      await scoreAgent(store, agent, scales, now);
    }

    stale += batch.length;

    if (batch.length < batchSize) break;
  }

  return { chains: dirtyChains.length, agents, stale, tags };
}
